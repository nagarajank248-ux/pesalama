import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api from '../api';

// Web Audio API Ringtone Synthesizer
class RingtonePlayer {
    constructor() {
        this.audioCtx = null;
        this.interval = null;
        this.type = null;
    }

    start(type) {
        this.stop();
        this.type = type;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            this.audioCtx = new AudioContextClass();
        } catch (e) {
            console.error("Web Audio API not supported", e);
            return;
        }

        const playTone = () => {
            if (!this.audioCtx || this.audioCtx.state === 'closed') return;
            
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const time = this.audioCtx.currentTime;

            if (type === 'calling') {
                // Outgoing dial tone: double beep (400Hz & 450Hz played together for 1.2s, then silent for 2s)
                const osc1 = this.audioCtx.createOscillator();
                const osc2 = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();

                osc1.frequency.value = 400;
                osc2.frequency.value = 450;
                
                gainNode.gain.setValueAtTime(0, time);
                gainNode.gain.linearRampToValueAtTime(0.12, time + 0.1);
                gainNode.gain.setValueAtTime(0.12, time + 1.2);
                gainNode.gain.exponentialRampToValueAtTime(0.001, time + 1.3);

                osc1.connect(gainNode);
                osc2.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);

                osc1.start(time);
                osc2.start(time);

                setTimeout(() => {
                    try {
                        osc1.stop();
                        osc2.stop();
                        osc1.disconnect();
                        osc2.disconnect();
                        gainNode.disconnect();
                    } catch (e) {}
                }, 1500);

            } else if (type === 'ringing') {
                // Incoming phone ringtone: warbling double ring (450Hz with LFO mod, 0.4s on, 0.2s off, 0.4s on, 2s silent)
                const playRingNode = (startTime, duration) => {
                    if (!this.audioCtx || this.audioCtx.state === 'closed') return;
                    
                    const osc = this.audioCtx.createOscillator();
                    const lfo = this.audioCtx.createOscillator();
                    const lfoGain = this.audioCtx.createGain();
                    const gainNode = this.audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, startTime);

                    lfo.frequency.value = 18; // 18Hz warble
                    lfoGain.gain.value = 30; // 30Hz range

                    gainNode.gain.setValueAtTime(0, startTime);
                    gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
                    gainNode.gain.setValueAtTime(0.25, startTime + duration - 0.05);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);
                    
                    osc.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);

                    lfo.start(startTime);
                    osc.start(startTime);

                    setTimeout(() => {
                        try {
                            lfo.stop();
                            osc.stop();
                            lfo.disconnect();
                            osc.disconnect();
                            lfoGain.disconnect();
                            gainNode.disconnect();
                        } catch (e) {}
                    }, (startTime - this.audioCtx.currentTime + duration + 0.5) * 1000);
                };

                playRingNode(time, 0.4);
                playRingNode(time + 0.6, 0.4);
            }
        };

        playTone();
        this.interval = setInterval(playTone, 3000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.audioCtx) {
            try {
                if (this.audioCtx.state !== 'closed') {
                    this.audioCtx.close();
                }
            } catch (e) {}
            this.audioCtx = null;
        }
        this.type = null;
    }
}

const Chat = ({ username, onLogout, onProfileClick }) => {
    console.log("Chat rendering:", { username });
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [showRequests, setShowRequests] = useState(false);
    const [searchCustomId, setSearchCustomId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showUserInfo, setShowUserInfo] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [typingTimeout, setTypingTimeout] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [showMenu, setShowMenu] = useState(false);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [mutedChats, setMutedChats] = useState([]);
    const [chatTheme, setChatTheme] = useState('default');
    const [customBg, setCustomBg] = useState('');
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [tempTheme, setTempTheme] = useState('default');
    const [tempCustomBg, setTempCustomBg] = useState('');
    const [searchMessageQuery, setSearchMessageQuery] = useState('');
    const [showSearchInput, setShowSearchInput] = useState(false);
    const [contextMenuMessageId, setContextMenuMessageId] = useState(null);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showDeleteOptionsModal, setShowDeleteOptionsModal] = useState(false);
    const [targetDeleteIds, setTargetDeleteIds] = useState([]);
    const [onlyShowDeleteForMe, setOnlyShowDeleteForMe] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [callStatus, setCallStatus] = useState('Calling...');
    const [callSeconds, setCallSeconds] = useState(0);
    const [isCallMuted, setIsCallMuted] = useState(false);
    const [isCallSpeaker, setIsCallSpeaker] = useState(false);
    const [callRole, setCallRole] = useState(null);
    const [callerName, setCallerName] = useState('');
    const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
    const [isCallMinimized, setIsCallMinimized] = useState(false);
    const [callPos, setCallPos] = useState({ x: 20, y: 80 });
    const [callSizeIndex, setCallSizeIndex] = useState(0); // 0 = S, 1 = M, 2 = L
    const [isDragging, setIsDragging] = useState(false);
    const [callPartnerName, setCallPartnerName] = useState('');
    const [callPartnerPic, setCallPartnerPic] = useState('');
    const [isRemoteVideoActive, setIsRemoteVideoActive] = useState(false);

    const dragStartRef = useRef({ x: 0, y: 0 });
    const posStartRef = useRef({ x: 0, y: 0 });
    const lastTapRef = useRef(0);

    const callSizes = [
        { width: 130, height: 190 }, // S
        { width: 170, height: 250 }, // M
        { width: 210, height: 310 }  // L
    ];
    const currentCallSize = callSizes[callSizeIndex];

    const handleDragStart = (e) => {
        if (e.touches && e.cancelable) e.preventDefault();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartRef.current = { x: clientX, y: clientY };
        posStartRef.current = { ...callPos };
        setIsDragging(true);
    };

    const handleDoubleTap = (e) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            setIsCallMinimized(false); // Maximize
        }
        lastTapRef.current = now;
    };

    useEffect(() => {
        if (!isDragging) return;
        
        const handleMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaX = clientX - dragStartRef.current.x;
            const deltaY = clientY - dragStartRef.current.y;
            
            setCallPos({
                x: Math.max(10, Math.min(window.innerWidth - currentCallSize.width - 10, posStartRef.current.x - deltaX)),
                y: Math.max(10, Math.min(window.innerHeight - currentCallSize.height - 10, posStartRef.current.y - deltaY))
            });
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, callPos, currentCallSize]);
    const [sidebarTab, setSidebarTab] = useState('chats');
    const [callLogs, setCallLogs] = useState([]);
    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const incomingOfferRef = useRef(null);
    const iceCandidatesQueueRef = useRef([]);
    const socketRef = useRef();
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const callRoleRef = useRef(null);
    const callStatusRef = useRef('Calling...');
    const callSecondsRef = useRef(0);
    const callerNameRef = useRef('');
    const selectedUserRef = useRef(null);
    const callTypeRef = useRef('audio');
    const friendsRef = useRef([]);

    useEffect(() => { callRoleRef.current = callRole; }, [callRole]);
    useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
    useEffect(() => { callSecondsRef.current = callSeconds; }, [callSeconds]);
    useEffect(() => { callerNameRef.current = callerName; }, [callerName]);
    useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
    useEffect(() => { callTypeRef.current = callType; }, [callType]);
    useEffect(() => { friendsRef.current = friends; }, [friends]);

    const isCallActiveRef = useRef(false);
    useEffect(() => { isCallActiveRef.current = isCallActive; }, [isCallActive]);

    const ringtonePlayerRef = useRef(null);
    if (!ringtonePlayerRef.current) {
        ringtonePlayerRef.current = new RingtonePlayer();
    }

    useEffect(() => {
        if (isCallActive) {
            if (callStatus === 'Calling...') {
                ringtonePlayerRef.current.start('calling');
            } else if (callStatus === 'Ringing...') {
                ringtonePlayerRef.current.start('ringing');
            } else if (callStatus === 'Connected') {
                ringtonePlayerRef.current.stop();
            }
        } else {
            ringtonePlayerRef.current.stop();
        }

        return () => {
            ringtonePlayerRef.current?.stop();
        };
    }, [isCallActive, callStatus]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const getActiveThemeStyle = () => {
        if (chatTheme === 'custom' && customBg) {
            return { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        }
        switch(chatTheme) {
            case 'ocean': return { background: 'linear-gradient(135deg, #0f172a 30%, #1e3a8a 100%)' };
            case 'forest': return { background: 'linear-gradient(135deg, #0f172a 30%, #064e3b 100%)' };
            case 'sunset': return { background: 'linear-gradient(135deg, #0f172a 30%, #451a03 100%)' };
            default: return { background: '#0f172a', backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' };
        }
    };

    const getThemeStyle = (themeName, customBgSrc) => {
        if (themeName === 'custom' && customBgSrc) {
            return { backgroundImage: `url(${customBgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        }
        switch(themeName) {
            case 'ocean': return { background: 'linear-gradient(135deg, #0f172a 30%, #1e3a8a 100%)' };
            case 'forest': return { background: 'linear-gradient(135deg, #0f172a 30%, #064e3b 100%)' };
            case 'sunset': return { background: 'linear-gradient(135deg, #0f172a 30%, #451a03 100%)' };
            default: return { background: '#0f172a', backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' };
        }
    };

    const handleThemeBgUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setTempCustomBg(reader.result);
            setTempTheme('custom');
        };
        reader.readAsDataURL(file);
    };

    const pressTimer = useRef(null);

    const startPress = (e, msg) => {
        
        // Handle coordinates for both touch and mouse events
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
        
        // Right-click triggers immediately
        if (e.button === 2) {
            setContextMenuMessageId(msg._id);
            setContextMenuPos({ x: clientX || 200, y: clientY || 200 });
            return;
        }

        if (pressTimer.current) clearTimeout(pressTimer.current);
        
        pressTimer.current = setTimeout(() => {
            setContextMenuMessageId(msg._id);
            setContextMenuPos({ x: clientX || 200, y: clientY || 200 });
        }, 600); // 600ms long-press duration
    };

    const endPress = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const handleSelectMessage = (messageId) => {
        if (selectedMessageIds.includes(messageId)) {
            setSelectedMessageIds(selectedMessageIds.filter(id => id !== messageId));
        } else {
            setSelectedMessageIds([...selectedMessageIds, messageId]);
        }
    };

    const handleMessageClick = (msg, e) => {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'BUTTON') return;
        if (isSelectionMode) {
            handleSelectMessage(msg._id);
        }
    };

    const toggleSelectAll = () => {
        if (selectedMessageIds.length === messages.length) {
            setSelectedMessageIds([]);
        } else {
            setSelectedMessageIds((messages || []).map(m => m._id));
        }
    };

    const exitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
    };

    const handleDeleteMessageClick = (msgId) => {
        const msg = messages.find(m => m._id === msgId);
        if (!msg) return;
        setContextMenuMessageId(null);
        setTargetDeleteIds([msgId]);
        setOnlyShowDeleteForMe(msg.sender !== username);
        setShowDeleteOptionsModal(true);
    };

    const handleMultiDeleteClick = () => {
        const selectedMsgs = (messages || []).filter(m => selectedMessageIds.includes(m._id));
        if (selectedMsgs.length === 0) return;
        
        const mixedOrReceivedOnly = selectedMsgs.some(m => m.sender !== username);
        setTargetDeleteIds(selectedMessageIds);
        setOnlyShowDeleteForMe(mixedOrReceivedOnly);
        setShowDeleteOptionsModal(true);
    };

    const performDelete = async (mode) => {
        try {
            if (mode === 'everyone') {
                await Promise.all(targetDeleteIds.map(id => api.delete(`/messages/${id}`)));
            } else {
                await Promise.all(targetDeleteIds.map(id => api.delete(`/messages/delete-for-me/${id}`)));
            }
            setMessages(prev => prev.filter(m => !targetDeleteIds.includes(m._id)));
            setShowDeleteOptionsModal(false);
            setTargetDeleteIds([]);
            setSelectedMessageIds([]);
            setIsSelectionMode(false);
        } catch (err) {
            console.error(err);
            alert("Failed to delete messages");
        }
    };

    const forwardMessages = (target) => {
        const isGroup = !!target.members;
        const targetId = isGroup ? target._id : target.username;
        const selectedMsgs = (messages || []).filter(m => selectedMessageIds.includes(m._id));
        
        selectedMsgs.forEach(m => {
            const messageData = {
                sender: username,
                text: m.text,
                messageType: m.messageType || 'text'
            };
            
            if (isGroup) {
                messageData.groupId = targetId;
                socketRef.current.emit('send_group_message', messageData);
            } else {
                messageData.receiver = targetId;
                socketRef.current.emit('send_message', messageData);
            }
        });
        
        alert(`Forwarded ${selectedMsgs.length} messages to ${isGroup ? target.name : target.username}!`);
        exitSelectionMode();
        setShowForwardModal(false);
    };

    const startCall = async (type = 'audio') => {
        setIsCallActive(true);
        setIsCallMinimized(false);
        setCallType(type);
        setCallRole('caller');
        setCallStatus('Calling...');
        setCallSeconds(0);
        setIsCallMuted(false);
        setIsCallSpeaker(false);
        setFacingMode('user');
        setCallPartnerName(selectedUser?.username || '');
        setCallPartnerPic(selectedUserData?.profilePic || '');
        setIsRemoteVideoActive(false);
        iceCandidatesQueueRef.current = [];

        try {
            const constraints = { audio: true, video: type === 'video' ? { facingMode: 'user' } : false };
            const localStream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = localStream;

            setTimeout(() => {
                if (type === 'video' && localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }
            }, 100);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            peerConnectionRef.current = pc;

            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            pc.onicecandidate = (event) => {
                if (event.candidate && socketRef.current) {
                    socketRef.current.emit("call_signal", {
                        to: selectedUser.username,
                        from: username,
                        type: "candidate",
                        signal: event.candidate
                    });
                }
            };

            pc.ontrack = (event) => {
                remoteStreamRef.current = event.streams[0];
                if (type === 'video') {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setIsRemoteVideoActive(true);
                    }
                } else {
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = event.streams[0];
                    }
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (socketRef.current) {
                console.log(`[WEBRTC] Emitting offer call_signal to ${selectedUser.username} from ${username} (type: ${type})`);
                socketRef.current.emit("call_signal", {
                    to: selectedUser.username,
                    from: username,
                    type: "offer",
                    signal: offer,
                    callType: type
                });
            } else {
                console.warn("[WEBRTC] Socket is not connected, cannot emit call_signal!");
            }
        } catch (err) {
            console.error("Error starting WebRTC call:", err);
            alert("Could not access camera/microphone: " + err.message);
            endVoiceCall();
        }
    };

    const acceptCall = async () => {
        setCallStatus('Connecting...');
        setIsCallMinimized(false);
        setIsRemoteVideoActive(false);
        setFacingMode('user');
        const type = callTypeRef.current;
        try {
            const constraints = { audio: true, video: type === 'video' ? { facingMode: 'user' } : false };
            const localStream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = localStream;

            setTimeout(() => {
                if (type === 'video' && localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }
            }, 100);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            peerConnectionRef.current = pc;

            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            pc.onicecandidate = (event) => {
                if (event.candidate && socketRef.current) {
                    socketRef.current.emit("call_signal", {
                        to: callerName,
                        from: username,
                        type: "candidate",
                        signal: event.candidate
                    });
                }
            };

            pc.ontrack = (event) => {
                remoteStreamRef.current = event.streams[0];
                if (type === 'video') {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setIsRemoteVideoActive(true);
                    }
                } else {
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = event.streams[0];
                    }
                }
            };

            if (incomingOfferRef.current) {
                await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                if (socketRef.current) {
                    socketRef.current.emit("call_signal", {
                        to: callerName,
                        from: username,
                        type: "answer",
                        signal: answer
                    });
                }

                // Process queued candidates
                if (iceCandidatesQueueRef.current.length > 0) {
                    for (const candidate of iceCandidatesQueueRef.current) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error("Error adding queued ICE candidate:", e);
                        }
                    }
                    iceCandidatesQueueRef.current = [];
                }

                setCallStatus('Connected');
            }
        } catch (err) {
            console.error("Error accepting WebRTC call:", err);
            alert("Could not access camera/microphone: " + err.message);
            endVoiceCall();
        }
    };

    const endVoiceCall = (emitEvent = true) => {
        // Save Call Log if we were the caller
        if (callRoleRef.current === 'caller' && selectedUserRef.current?.username) {
            let outcomeText = 'cancelled';
            if (callStatusRef.current === 'Connected') {
                outcomeText = `duration:${callSecondsRef.current}`;
            } else if (callStatusRef.current === 'Ringing...' || callStatusRef.current === 'Calling...') {
                outcomeText = 'missed';
            }

            if (socketRef.current) {
                socketRef.current.emit('send_message', {
                    sender: username,
                    receiver: selectedUserRef.current.username,
                    text: outcomeText,
                    messageType: 'call'
                });
            }
        }

        if (emitEvent && socketRef.current) {
            const targetUser = callRoleRef.current === 'caller' ? selectedUserRef.current?.username : callerNameRef.current;
            if (targetUser) {
                socketRef.current.emit("call_signal", {
                    to: targetUser,
                    from: username,
                    type: "hangup"
                });
            }
        }

        // Clean up media streams
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        remoteStreamRef.current = null;
        incomingOfferRef.current = null;
        iceCandidatesQueueRef.current = [];

        setIsCallActive(false);
        setIsCallMinimized(false);
        setIsRemoteVideoActive(false);
        setCallRole(null);
        setCallerName('');
        setCallPartnerName('');
        setCallPartnerPic('');
        setCallStatus('Calling...');
        setCallSeconds(0);
        setFacingMode('user');
    };

    // Timer effect for connected calls
    useEffect(() => {
        if (!isCallActive || callStatus !== 'Connected') return;

        const interval = setInterval(() => {
            setCallSeconds(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isCallActive, callStatus]);

    // Handle toggles
    const toggleCallMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsCallMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    };

    const switchCamera = async () => {
        if (!localStreamRef.current || callType !== 'video') return;

        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);

        try {
            const videoTracks = localStreamRef.current.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks.forEach(track => {
                    track.stop();
                    localStreamRef.current.removeTrack(track);
                });
            }

            const constraints = {
                video: { facingMode: newFacingMode }
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newVideoTrack = newStream.getVideoTracks()[0];

            localStreamRef.current.addTrack(newVideoTrack);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            if (peerConnectionRef.current) {
                const senders = peerConnectionRef.current.getSenders();
                const sender = senders.find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }
        } catch (err) {
            console.error("Error switching camera:", err);
            alert("Could not switch camera: " + err.message);
        }
    };

    const triggerPiP = async () => {
        try {
            if (remoteVideoRef.current && document.pictureInPictureEnabled) {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await remoteVideoRef.current.requestPictureInPicture();
                }
            }
        } catch (e) {
            console.error("PiP error:", e);
        }
    };

    const formatCallTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(scrollToBottom, [messages]);

    const handleTyping = () => {
        const targetUsername = selectedUser?.username;
        if (!targetUsername || selectedGroup || !socketRef.current) return;

        socketRef.current.emit('typing', { sender: username, receiver: targetUsername });

        if (typingTimeout) clearTimeout(typingTimeout);

        setTypingTimeout(setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit('stop_typing', { sender: username, receiver: targetUsername });
            }
        }, 3000));
    };

    useEffect(() => {
        return () => {
            if (typingTimeout) clearTimeout(typingTimeout);
        };
    }, [typingTimeout]);

    useEffect(() => {
        console.log("Socket effect triggered");
        socketRef.current = io(import.meta.env.VITE_SOCKET_URL);
        socketRef.current.emit('register', username);

        socketRef.current.on('receive_message', (message) => {
            if (message?.messageType === 'call') {
                setCallLogs(prev => [message, ...prev.filter(c => c._id !== message._id)]);
            }

            const targetUsername = selectedUser?.username;
            const isForCurrentChat = selectedGroup 
                ? message?.groupId === selectedGroup?._id
                : ((message?.sender === username && message?.receiver === targetUsername) ||
                   (message?.sender === targetUsername && message?.receiver === username));

            if (isForCurrentChat) {
                setMessages((prev) => [...prev, message]);
                if (!selectedGroup && message?.receiver === username && message?.sender === targetUsername) {
                    socketRef.current.emit('mark_chat_read', { sender: message?.sender, receiver: username });
                }
            } else {
                // Increment unread count for the sender
                if (!message.isGroup && message.receiver === username) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [message.sender]: (prev[message.sender] || 0) + 1
                    }));
                }
            }
        });

        socketRef.current.on('chat_read', (data) => {
            if (data?.reader === selectedUser?.username) {
                setMessages(prev => (prev || []).map(m => ({ ...m, status: 'read' })));
            }
        });

        socketRef.current.on('user_typing', (data) => {
            if (data?.sender === selectedUser?.username) {
                setTypingUser(data?.sender);
            }
        });

        socketRef.current.on('user_stop_typing', (data) => {
            if (data?.sender === selectedUser?.username) {
                setTypingUser(null);
            }
        });

        socketRef.current.on('user_status_change', (data) => {
            setFriends(prev => (prev || []).map(u => u?.username === data?.username ? { ...u, isOnline: data?.isOnline, lastSeen: data?.lastSeen } : u));
        });

        socketRef.current.on('message_read', (data) => {
            setMessages(prev => (prev || []).map(m => m?._id === data?.messageId ? { ...m, status: 'read' } : m));
        });

        socketRef.current.on('call_signal', async (data) => {
            const { from, signal, type, callType: incomingCallType } = data;
            console.log(`[WEBRTC RECEIVE] Received call_signal from ${from} (type: ${type})`, signal);

            if (type === 'offer') {
                if (isCallActiveRef.current) {
                    console.log(`[WEBRTC] User is busy. Rejecting incoming call from ${from}`);
                    socketRef.current.emit("call_signal", {
                        to: from,
                        from: username,
                        type: "busy"
                    });
                    return;
                }
                incomingOfferRef.current = signal;
                setCallType(incomingCallType || 'audio');
                setCallerName(from);
                setCallPartnerName(from);
                const callerUser = (friendsRef.current || []).find(u => u?.username === from);
                setCallPartnerPic(callerUser?.profilePic || '');
                setCallRole('callee');
                setCallStatus('Ringing...');
                setIsCallActive(true);
                setIsCallMuted(false);
                setIsCallSpeaker(false);
            } else if (type === 'answer') {
                if (peerConnectionRef.current) {
                    try {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
                        setCallStatus('Connected');

                        if (iceCandidatesQueueRef.current.length > 0) {
                            for (const candidate of iceCandidatesQueueRef.current) {
                                try {
                                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                                } catch (e) {
                                    console.error("Error adding queued ICE candidate:", e);
                                }
                            }
                            iceCandidatesQueueRef.current = [];
                        }
                    } catch (e) {
                        console.error("Error setting remote description:", e);
                    }
                }
            } else if (type === 'candidate') {
                if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal));
                    } catch (e) {
                        console.error("Error adding ICE candidate:", e);
                    }
                } else {
                    iceCandidatesQueueRef.current.push(signal);
                }
            } else if (type === 'busy') {
                setCallStatus('Busy');
                setTimeout(() => {
                    endVoiceCall(false);
                }, 3000);
            } else if (type === 'hangup') {
                endVoiceCall(false);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [username, selectedUser, selectedGroup]);

    const fetchData = async () => {
        try {
            const [friendsRes, groupsRes, profileRes, unreadRes, callsRes] = await Promise.all([
                api.get('/auth/friends'),
                api.get('/groups'),
                api.get('/auth/profile'),
                api.get('/messages/unread/counts'),
                api.get('/messages/calls/history').catch(err => {
                    console.error("Calls history fetch error", err);
                    return { data: [] };
                })
            ]);
            setFriends(friendsRes.data || []);
            setGroups(groupsRes.data || []);
            setProfileData(profileRes.data || null);
            setBlockedUsers(profileRes.data?.blockedUsers || []);
            setFriendRequests(profileRes.data?.friendRequests?.filter(r => r.status === 'pending') || []);
            setUnreadCounts(unreadRes.data || {});
            setCallLogs(callsRes.data || []);
        } catch (err) {
            console.error("Data fetch error", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const clearChat = async () => {
        if (!selectedUser?.username) return;
        if (!window.confirm(`Clear all messages with ${selectedUser.username}?`)) return;
        try {
            await api.delete(`/messages/clear/${selectedUser.username}`);
            setMessages([]);
        } catch (err) {
            console.error(err);
        }
    };

    const deleteMessage = async (messageId) => {
        if (!window.confirm("Delete this message?")) return;
        try {
            await api.delete(`/messages/${messageId}`);
            setMessages(prev => prev.filter(m => m._id !== messageId));
        } catch (err) {
            console.error(err);
        }
    };

    const handleProfilePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const { data } = await api.post('/auth/profile-pic', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProfileData(data);
            alert("Profile picture updated!");
            fetchData(); // Refresh friends list too
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload profile picture");
        }
    };

    const sendRequest = async () => {
        if (!searchCustomId) return;
        try {
            await api.post('/auth/friend-request', { targetCustomId: searchCustomId });
            alert("Friend request sent!");
            setSearchCustomId('');
        } catch (err) {
            alert(err.response?.data?.error || "Error sending request");
        }
    };

    const respondRequest = async (fromUsername, action) => {
        try {
            await api.post('/auth/friend-request/respond', { fromUsername, action });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleBlock = async () => {
        if (!selectedUser?.username) return;
        try {
            const isBlocked = blockedUsers.includes(selectedUser.username);
            if (isBlocked) {
                await api.post('/auth/unblock', { targetUsername: selectedUser.username });
                setBlockedUsers(prev => (prev || []).filter(u => u !== selectedUser.username));
            } else {
                await api.post('/auth/block', { targetUsername: selectedUser.username });
                setBlockedUsers(prev => [...(prev || []), selectedUser.username]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteGroup = async () => {
        if (!selectedGroup?._id) return;
        if (!window.confirm("Are you sure you want to delete this group?")) return;
        try {
            await api.delete(`/groups/${selectedGroup._id}`);
            setGroups(prev => (prev || []).filter(g => g?._id !== selectedGroup._id));
            setSelectedGroup(null);
            alert("Group deleted");
        } catch (err) {
            alert(err.response?.data?.error || "Failed to delete group");
        }
    };

    useEffect(() => {
        const fetchMessages = async () => {
            if (selectedGroup?._id) {
                if (socketRef.current) socketRef.current.emit('join_group', selectedGroup._id);
                try {
                    const { data } = await api.get(`/messages/group/${selectedGroup._id}`);
                    setMessages(data || []);
                } catch (err) {
                    console.error(err);
                }
            } else if (selectedUser?.username) {
                try {
                    const { data } = await api.get(`/messages/${selectedUser.username}`);
                    setMessages(data || []);

                    if (socketRef.current) {
                        const hasUnread = (data || []).some(m => m?.receiver === username && m?.status !== 'read');
                        if (hasUnread) {
                            socketRef.current.emit('mark_chat_read', { sender: selectedUser.username, receiver: username });
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };
        fetchMessages();
    }, [selectedUser, selectedGroup, username]);

    const sendMessage = (e, imageData = null) => {
        if (e) e.preventDefault();
        const targetUsername = selectedUser?.username;
        if ((newMessage.trim() || imageData) && (targetUsername || selectedGroup)) {
            const messageData = {
                sender: username,
                text: imageData ? imageData : newMessage,
                messageType: imageData ? 'image' : 'text'
            };

            if (selectedGroup) {
                messageData.groupId = selectedGroup._id;
                socketRef.current.emit('send_group_message', messageData);
            } else {
                messageData.receiver = targetUsername;
                socketRef.current.emit('send_message', messageData);
            }

            setNewMessage('');
            setShowEmojiPicker(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const { data } = await api.post('/messages/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            sendMessage(null, data.url);
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload image");
        }
    };

    const createGroup = async () => {
        if (!groupName || !groupMembers?.length) return;
        try {
            const { data } = await api.post('/groups', { name: groupName, members: groupMembers });
            setGroups(prev => [...(prev || []), data]);
            setShowCreateGroup(false);
            setGroupName('');
            setGroupMembers([]);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredFriends = (friends || []).filter(u => 
        u?.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedUserData = (friends || []).find(u => u?.username === selectedUser?.username);
    const activeChatId = selectedGroup ? selectedGroup._id : selectedUser?.username;
    const isCurrentChatMuted = mutedChats.includes(activeChatId);

    return (
        <div className="chat-layout-container" style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div className={`chat-sidebar ${selectedUser || selectedGroup ? 'hidden-on-mobile' : ''}`} style={{ width: '350px', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b50' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Creative Premium App Logo */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '38px', 
                                height: '38px', 
                                borderRadius: '12px', 
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                                position: 'relative',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                                    <path d="M14 8c0-2.21-1.79-4-4-4S6 5.79 6 8c0 1 .37 1.91 1 2.62L5 14l3.38-1.38c.62.38 1.34.62 2.62.62 2.21 0 4-1.79 4-4z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" />
                                    <path d="M18 12c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 1 .37 1.91 1 2.62L9 18l3.38-1.38c.62.38 1.34.62 2.62.62 2.21 0 4-1.79 4-4z" />
                                </svg>
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, background: 'linear-gradient(to right, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>Pesuvoma</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                             <button onClick={() => setShowRequests(!showRequests)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                                🔔 {(friendRequests || []).length > 0 && <span style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: '50%', fontSize: '10px', padding: '2px 5px' }}>{friendRequests.length}</span>}
                             </button>
                             
                             {/* 3-Dot Dropdown Menu */}
                             <div style={{ position: 'relative' }}>
                                 <button 
                                     onClick={() => setShowMenu(!showMenu)} 
                                     style={{ 
                                         background: 'none', 
                                         border: 'none', 
                                         cursor: 'pointer', 
                                         fontSize: '22px', 
                                         color: '#f8fafc',
                                         padding: '0 4px',
                                         display: 'flex',
                                         alignItems: 'center'
                                     }}
                                 >
                                     ⋮
                                 </button>
                                 {showMenu && (
                                     <>
                                         <div 
                                             onClick={() => setShowMenu(false)}
                                             style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, backgroundColor: 'transparent' }}
                                         />
                                         <div style={{
                                             position: 'absolute',
                                             right: 0,
                                             top: '30px',
                                             backgroundColor: '#1e293b',
                                             border: '1px solid rgba(255,255,255,0.1)',
                                             borderRadius: '12px',
                                             width: '150px',
                                             boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                             zIndex: 100,
                                             overflow: 'hidden'
                                         }}>
                                             <button 
                                                 onClick={() => { setShowMenu(false); setShowCreateGroup(true); }}
                                                 style={{
                                                     width: '100%',
                                                     padding: '12px 16px',
                                                     textAlign: 'left',
                                                     background: 'none',
                                                     border: 'none',
                                                     color: 'white',
                                                     cursor: 'pointer',
                                                     fontSize: '14px',
                                                     borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                     display: 'block'
                                                 }}
                                                 onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                 onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                             >
                                                 Create Group
                                             </button>
                                             <button 
                                                 onClick={() => { setShowMenu(false); onProfileClick(); }}
                                                 style={{
                                                     width: '100%',
                                                     padding: '12px 16px',
                                                     textAlign: 'left',
                                                     background: 'none',
                                                     border: 'none',
                                                     color: 'white',
                                                     cursor: 'pointer',
                                                     fontSize: '14px',
                                                     display: 'block'
                                                 }}
                                                 onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                 onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                             >
                                                 Settings
                                             </button>
                                         </div>
                                     </>
                                 )}
                             </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <input type="text" placeholder="Add by ID..." value={searchCustomId} onChange={(e) => setSearchCustomId(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: '#334155', color: 'white', outline: 'none' }} />
                        <button onClick={sendRequest} style={{ backgroundColor: '#6366f1', border: 'none', borderRadius: '10px', padding: '0 15px', color: 'white', cursor: 'pointer' }}>Add</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input type="text" placeholder="Search chats..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px 16px', borderRadius: '12px', border: 'none', backgroundColor: '#334155', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    {/* Segmented Tab Navigation for Sidebar */}
                    <div style={{ 
                        display: 'flex', 
                        backgroundColor: '#1e293b50', 
                        padding: '4px', 
                        borderRadius: '10px', 
                        marginTop: '15px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <button
                            onClick={() => setSidebarTab('chats')}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                transition: 'all 0.2s',
                                backgroundColor: sidebarTab === 'chats' ? '#6366f1' : 'transparent',
                                color: sidebarTab === 'chats' ? 'white' : '#94a3b8',
                                outline: 'none'
                            }}
                        >
                            Chats
                        </button>
                        <button
                            onClick={() => setSidebarTab('calls')}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                transition: 'all 0.2s',
                                backgroundColor: sidebarTab === 'calls' ? '#6366f1' : 'transparent',
                                color: sidebarTab === 'calls' ? 'white' : '#94a3b8',
                                outline: 'none'
                            }}
                        >
                            Calls
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {sidebarTab === 'chats' ? (
                        <>
                            {showRequests && (
                                <div style={{ marginBottom: '20px', backgroundColor: '#33415550', borderRadius: '12px', padding: '10px' }}>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Requests</div>
                                    {(friendRequests || []).length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8' }}>No pending requests</div> : 
                                        friendRequests.map(r => (
                                            <div key={r.from} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{r.from}</span>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button onClick={() => respondRequest(r.from, 'accept')} style={{ backgroundColor: '#10b981', border: 'none', borderRadius: '5px', padding: '4px 8px', color: 'white', fontSize: '10px', cursor: 'pointer' }}>Accept</button>
                                                    <button onClick={() => respondRequest(r.from, 'reject')} style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '5px', padding: '4px 8px', color: 'white', fontSize: '10px', cursor: 'pointer' }}>Reject</button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Groups</div>
                            {(groups || []).filter(g => g?.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(g => (
                                <div key={g?._id} onClick={() => { setSelectedGroup(g); setSelectedUser(null); setShowUserInfo(false); setTypingUser(null); }} style={{ padding: '12px', borderRadius: '12px', cursor: 'pointer', backgroundColor: selectedGroup?._id === g?._id ? '#334155' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s', marginBottom: '4px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', overflow: 'hidden' }}>
                                        {g?.profilePic ? <img src={g.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : 'G'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {g?.name}
                                            {mutedChats.includes(g?._id) && <span style={{ fontSize: '12px' }} title="Muted">🔇</span>}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{(g?.members || []).length} members</div>
                                    </div>
                                </div>
                            ))}

                            <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '10px' }}>Friends</div>
                            {filteredFriends.map(u => (
                                <div key={u?.username} onClick={() => { 
                                    setSelectedUser(u); 
                                    setSelectedGroup(null); 
                                    setShowUserInfo(false); 
                                    setTypingUser(null); 
                                    setUnreadCounts(prev => ({ ...prev, [u.username]: 0 }));
                                }} style={{ padding: '12px', borderRadius: '12px', cursor: 'pointer', backgroundColor: selectedUser?.username === u?.username ? '#334155' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s', marginBottom: '4px', position: 'relative' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: u?.isOnline ? '#10b981' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', overflow: 'hidden' }}>
                                        {u?.profilePic ? <img src={u.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : (u?.username ? u.username[0].toUpperCase() : '?')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {u?.username}
                                                {mutedChats.includes(u?.username) && <span style={{ fontSize: '12px' }} title="Muted">🔇</span>}
                                            </div>
                                            {unreadCounts[u.username] > 0 && (
                                                <span style={{ backgroundColor: '#6366f1', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
                                                    {unreadCounts[u.username]}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{u?.isOnline ? 'Online' : 'Offline'}</div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        /* Calls History List Rendering */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Call History</div>
                            {callLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
                                    No calls made or received
                                </div>
                            ) : (
                                callLogs.map((log) => {
                                    const isOutgoing = log.sender === username;
                                    const peerName = isOutgoing ? log.receiver : log.sender;
                                    const peerFriend = friends.find(f => f.username === peerName);
                                    
                                    return (
                                        <div 
                                            key={log._id}
                                            style={{ 
                                                padding: '12px', 
                                                borderRadius: '12px', 
                                                backgroundColor: 'rgba(255,255,255,0.02)', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                border: '1px solid rgba(255,255,255,0.03)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px', overflow: 'hidden' }}>
                                                    {peerFriend?.profilePic ? (
                                                        <img src={peerFriend.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        peerName ? peerName[0].toUpperCase() : '?'
                                                    )}
                                                </div>
                                                
                                                <div>
                                                    <div style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>{peerName}</div>
                                                    <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        {(() => {
                                                            const isVideo = log.text?.startsWith('video_');
                                                            const cleanText = isVideo ? log.text.replace('video_', '') : log.text;
                                                            const isMissed = cleanText === 'missed';
                                                            const isCancelled = cleanText === 'cancelled';
                                                            const isDur = cleanText?.startsWith('duration:');

                                                            let statusColor = '#10b981';
                                                            let statusLabel = isOutgoing ? 'Outgoing' : 'Incoming';
                                                            if (isMissed) {
                                                                statusColor = '#ef4444';
                                                                statusLabel = isOutgoing ? 'Missed (No Answer)' : 'Missed';
                                                            } else if (isCancelled) {
                                                                statusColor = '#94a3b8';
                                                                statusLabel = 'Cancelled';
                                                            } else if (isDur) {
                                                                const durSecs = parseInt(cleanText.split(':')[1]) || 0;
                                                                const mins = Math.floor(durSecs / 60);
                                                                const secs = durSecs % 60;
                                                                statusLabel += ` (${mins}:${secs.toString().padStart(2, '0')})`;
                                                            }

                                                            return (
                                                                <span style={{ color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    {isVideo ? (
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                                                    ) : (
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                                    )}
                                                                    {isVideo ? 'Video' : 'Voice'} {statusLabel}
                                                                </span>
                                                            );
                                                        })()}
                                                        <span>•</span>
                                                        <span style={{ whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => {
                                                    const targetFriend = friends.find(f => f.username === peerName);
                                                    const isVideo = log.text?.startsWith('video_');
                                                    if (targetFriend) {
                                                        setSelectedUser(targetFriend);
                                                        setSelectedGroup(null);
                                                        setTimeout(() => {
                                                            startCall(isVideo ? 'video' : 'audio');
                                                        }, 150);
                                                    }
                                                }}
                                                title="Call Back"
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: '#818cf8', 
                                                    cursor: 'pointer', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    width: '32px', 
                                                    height: '32px', 
                                                    borderRadius: '50%',
                                                    transition: 'all 0.2s',
                                                    backgroundColor: 'rgba(255,255,255,0.03)'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`chat-area-container ${!(selectedUser || selectedGroup) ? 'hidden-on-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', position: 'relative' }}>
                {selectedUser || selectedGroup ? (
                    <>
                        {isSelectionMode ? (
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', animation: 'fadeIn 0.2s ease-out' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button 
                                        onClick={exitSelectionMode} 
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        ✕
                                    </button>
                                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedMessageIds.length} Selected</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Select All / Deselect All Icon Button */}
                                    <button 
                                        onClick={toggleSelectAll} 
                                        title={selectedMessageIds.length === messages.length ? "Deselect All" : "Select All"}
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        {selectedMessageIds.length === messages.length ? (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        ) : (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                        )}
                                    </button>

                                    {/* Forward Button */}
                                    <button 
                                        onClick={() => setShowForwardModal(true)} 
                                        title="Forward Selected"
                                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 9 15 15"/><path d="M3 21v-7a4 4 0 0 1 4-4h14"/></svg>
                                    </button>

                                    {/* Delete Button */}
                                    <button 
                                        onClick={handleMultiDeleteClick} 
                                        title="Delete Selected"
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    </button>
                            </div>
                        </div>
                    ) : (
                            <div className="chat-area-header" style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b50', zIndex: 5 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <button 
                                        className="back-button-mobile"
                                        onClick={() => { setSelectedUser(null); setSelectedGroup(null); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#6366f1',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            padding: '0 8px 0 0',
                                            display: 'none'
                                        }}
                                    >
                                        ←
                                    </button>
                                    <div onClick={() => setShowUserInfo(!showUserInfo)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', minWidth: 0 }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: selectedGroup ? '#10b981' : (selectedUserData?.isOnline ? '#10b981' : '#6366f1'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
                                            {selectedGroup ? 'G' : (selectedUserData?.profilePic ? <img src={selectedUserData.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : (selectedUser?.username ? selectedUser.username[0].toUpperCase() : '?'))}
                                        </div>
                                        <div style={{ overflow: 'hidden' }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {selectedGroup ? selectedGroup.name : selectedUser?.username}
                                                {mutedChats.includes(selectedGroup ? selectedGroup._id : selectedUser?.username) && <span style={{ fontSize: '14px' }} title="Muted">🔇</span>}
                                            </h3>
                                            <div style={{ fontSize: '12px', color: typingUser ? '#6366f1' : (selectedGroup ? '#94a3b8' : (selectedUserData?.isOnline ? '#10b981' : '#94a3b8')), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {selectedGroup ? `${(selectedGroup?.members || []).length} members` : (typingUser ? 'typing...' : (selectedUserData?.isOnline ? 'Online' : selectedUserData?.lastSeen ? `Last seen ${new Date(selectedUserData.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Offline'))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    {/* Audio and Video Call Icons on the right side */}
                                    {!selectedGroup && !showSearchInput && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startCall('audio'); }}
                                                title="Start Audio Call"
                                                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', transition: 'all 0.2s', outline: 'none' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#6366f1'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#818cf8'; }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startCall('video'); }}
                                                title="Start Video Call"
                                                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', transition: 'all 0.2s', outline: 'none' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#6366f1'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#818cf8'; }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                            </button>
                                        </div>
                                    )}
                                    {showSearchInput && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#334155', borderRadius: '8px', padding: '6px 12px' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Search messages..." 
                                                value={searchMessageQuery} 
                                                onChange={(e) => setSearchMessageQuery(e.target.value)} 
                                                style={{ background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: '14px', width: '130px' }} 
                                            />
                                            <button onClick={() => { setShowSearchInput(false); setSearchMessageQuery(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: 0 }}>✕</button>
                                        </div>
                                    )}
                                    {!selectedGroup && (
                                        <div style={{ position: 'relative' }}>
                                        <button 
                                            onClick={() => setShowChatMenu(!showChatMenu)} 
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                fontSize: '22px', 
                                                color: '#94a3b8',
                                                padding: '0 8px',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            ⋮
                                        </button>
                                        {showChatMenu && (
                                            <>
                                                <div 
                                                    onClick={() => setShowChatMenu(false)}
                                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, backgroundColor: 'transparent' }}
                                                />
                                                <div style={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: '30px',
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px',
                                                    width: '160px',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                    zIndex: 100,
                                                    overflow: 'hidden'
                                                }}>
                                                    <button 
                                                        onClick={() => { setShowChatMenu(false); setShowUserInfo(true); }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            textAlign: 'left',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        Contact Info
                                                    </button>
                                                    <button 
                                                        onClick={() => { setShowChatMenu(false); setShowSearchInput(true); }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            textAlign: 'left',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        Search Chat
                                                    </button>
                                                    <button 
                                                        onClick={() => { 
                                                            setShowChatMenu(false); 
                                                            if (isCurrentChatMuted) {
                                                                setMutedChats(mutedChats.filter(id => id !== activeChatId));
                                                                alert("Chat unmuted!");
                                                            } else {
                                                                setMutedChats([...mutedChats, activeChatId]);
                                                                alert("Chat muted!");
                                                            }
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            textAlign: 'left',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        {isCurrentChatMuted ? "Unmute Chat" : "Mute Chat"}
                                                    </button>
                                                    <button 
                                                        onClick={() => { 
                                                            setShowChatMenu(false); 
                                                            setTempTheme(chatTheme);
                                                            setTempCustomBg(customBg);
                                                            setShowThemeModal(true);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            textAlign: 'left',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        Chat Theme
                                                    </button>
                                                    <button 
                                                        onClick={() => { setShowChatMenu(false); clearChat(); }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            textAlign: 'left',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                                    >
                                                        Clear Chat
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="chat-messages-list" style={{ ...getActiveThemeStyle() }}>
                            {(messages || []).filter(m => m?.text?.toLowerCase().includes(searchMessageQuery.toLowerCase())).map((m, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={(e) => handleMessageClick(m, e)}
                                    style={{ 
                                        alignSelf: m?.sender === username ? 'flex-end' : 'flex-start', 
                                        maxWidth: '75%', 
                                        position: 'relative', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px', 
                                        flexDirection: m?.sender === username ? 'row-reverse' : 'row',
                                        cursor: 'pointer'
                                    }} 
                                    className="message-container"
                                >
                                    {isSelectionMode && (
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMessageIds.includes(m._id)}
                                            onChange={() => handleSelectMessage(m._id)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: m?.sender === username ? 'flex-end' : 'flex-start', flex: 1 }}>
                                        {selectedGroup && m?.sender !== username && <div style={{ fontSize: '10px', color: '#6366f1', marginBottom: '2px' }}>{m?.sender}</div>}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: m?.sender === username ? 'row-reverse' : 'row' }}>
                                            <div 
                                                style={{ 
                                                    padding: '10px 16px', 
                                                    borderRadius: m?.sender === username ? '16px 16px 2px 16px' : '16px 16px 16px 2px', 
                                                    backgroundColor: m?.sender === username ? '#6366f1' : '#334155', 
                                                    color: 'white', 
                                                    fontSize: '14px', 
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    WebkitUserSelect: 'none'
                                                }}
                                                onMouseDown={(e) => startPress(e, m)}
                                                onMouseUp={endPress}
                                                onMouseLeave={endPress}
                                                onTouchStart={(e) => startPress(e, m)}
                                                onTouchEnd={endPress}
                                                onTouchMove={endPress}
                                                onContextMenu={(e) => e.preventDefault()}
                                            >
                                                {m?.messageType === 'image' ? (
                                                    <img src={m?.text} alt="chat" style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(m?.text, '_blank')} />
                                                ) : m?.messageType === 'call' ? (
                                                    (() => {
                                                        const isVideo = m?.text?.startsWith('video_');
                                                        const cleanText = isVideo ? m.text.replace('video_', '') : m.text;
                                                        const isMissed = cleanText === 'missed';
                                                        const isCancelled = cleanText === 'cancelled';
                                                        const isDur = cleanText?.startsWith('duration:');

                                                        let bubbleTitle = '';
                                                        if (isMissed) {
                                                            bubbleTitle = m?.sender === username 
                                                                ? `Missed ${isVideo ? 'Video' : 'Voice'} Call (No Answer)` 
                                                                : `Missed ${isVideo ? 'Video' : 'Voice'} Call`;
                                                        } else if (isCancelled) {
                                                            bubbleTitle = `Cancelled ${isVideo ? 'Video' : 'Voice'} Call`;
                                                        } else {
                                                            bubbleTitle = m?.sender === username 
                                                                ? `Outgoing ${isVideo ? 'Video' : 'Voice'} Call` 
                                                                : `Incoming ${isVideo ? 'Video' : 'Voice'} Call`;
                                                        }

                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                                                                <div style={{ 
                                                                    width: '36px', 
                                                                    height: '36px', 
                                                                    borderRadius: '50%', 
                                                                    backgroundColor: isMissed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center',
                                                                    color: isMissed ? '#ef4444' : '#10b981'
                                                                }}>
                                                                    {isMissed ? (
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                                    ) : isVideo ? (
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                                                    ) : (
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{bubbleTitle}</div>
                                                                    {isDur && (
                                                                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                                                                            Duration: {formatCallTime(parseInt(cleanText.split(':')[1] || '0', 10))}
                                                                        </div>
                                                                    )}
                                                                    {!isDur && (
                                                                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                                                                            {isMissed ? 'No answer' : 'Cancelled'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : m?.text}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'flex', justifyContent: m?.sender === username ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '4px' }}>
                                            {new Date(m?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {m?.sender === username && !selectedGroup && (
                                                <span style={{ color: m?.status === 'read' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>
                                                    {m?.status === 'read' ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-container">
                            {showEmojiPicker && (
                                <div style={{ position: 'absolute', bottom: '100%', left: '20px', zIndex: 100 }}>
                                    <EmojiPicker onEmojiClick={(emojiObject) => setNewMessage(prev => (prev || '') + emojiObject.emoji)} theme="dark" />
                                </div>
                            )}
                            <form onSubmit={sendMessage} className="chat-input-form">
                                <div className="chat-input-wrapper">
                                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}>😊</button>
                                    <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}>📎</button>
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />
                                    <input type="text" className="chat-input-field" value={newMessage} onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }} placeholder="Type a message..." style={{ backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none' }} />
                                </div>
                                <button 
                                    type="submit" 
                                    style={{ 
                                        backgroundColor: '#6366f1', 
                                        color: 'white', 
                                        border: 'none', 
                                        width: '44px', 
                                        height: '44px', 
                                        borderRadius: '50%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        padding: 0,
                                        boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                                    }}
                                    title="Send"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '18px', height: '18px', transform: 'translateX(1px)' }}>
                                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.53 60.53 0 0 0 18.258-7.793.75.75 0 0 0 0-1.254A60.53 60.53 0 0 0 3.478 2.404Z" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <div style={{ fontSize: '64px' }}>💬</div>
                        <h2>Select a chat to start messaging</h2>
                    </div>
                )}
            </div>

            {showCreateGroup && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '20px', width: '400px' }}>
                        <h2 style={{ marginTop: 0 }}>Create New Group</h2>
                        <input type="text" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#334155', color: 'white', marginBottom: '20px', boxSizing: 'border-box' }} />
                        <div style={{ marginBottom: '10px', fontSize: '14px', color: '#94a3b8' }}>Select Members:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {friends.map(u => (
                                <div key={u.username} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <input type="checkbox" checked={groupMembers.includes(u.username)} onChange={(e) => { if (e.target.checked) setGroupMembers([...groupMembers, u.username]); else setGroupMembers(groupMembers.filter(m => m !== u.username)); }} />
                                    <span>{u.username}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCreateGroup(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={createGroup} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#6366f1', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {showUserInfo && (
                <div className="user-info-sidebar" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '300px', backgroundColor: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out', zIndex: 10 }}>
                    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #334155' }}>
                        <button onClick={() => setShowUserInfo(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                        <h3 style={{ margin: 0 }}>{selectedGroup ? 'Group Info' : 'Contact Info'}</h3>
                    </div>
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 'bold', marginBottom: '20px', overflow: 'hidden' }}>
                            {selectedGroup ? 'G' : (selectedUserData?.profilePic ? <img src={selectedUserData.profilePic} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : (selectedUser?.username ? selectedUser.username[0].toUpperCase() : '?'))}
                        </div>
                        <h2 style={{ margin: '0 0 5px 0' }}>{selectedGroup ? selectedGroup.name : selectedUser?.username}</h2>
                        <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px' }}>{selectedGroup ? `${(selectedGroup?.members || []).length} members` : (selectedUserData?.isOnline ? 'Online' : 'Offline')}</div>
                        
                        {selectedGroup ? (
                            <div style={{ width: '100%', textAlign: 'left', backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px' }}>
                                <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>Members</div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '15px' }}>
                                    {(selectedGroup?.members || []).map(m => (
                                        <div key={m} style={{ fontSize: '14px', padding: '4px 0' }}>{m} {m === selectedGroup?.admin && <span style={{fontSize: '10px', backgroundColor: '#6366f1', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px'}}>Admin</span>}</div>
                                    ))}
                                </div>
                                {selectedGroup?.admin === username && (
                                    <button onClick={handleDeleteGroup} style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Delete Group</button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div style={{ width: '100%', textAlign: 'left', backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                                    <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>About</div>
                                    <div style={{ color: 'white', fontSize: '14px' }}>{selectedUserData?.bio || "Hey there! I'm using Pesuvoma."}</div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                    <button onClick={clearChat} style={{ width: '100%', padding: '12px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Clear Chat</button>
                                    <button onClick={handleBlock} style={{ width: '100%', padding: '12px', backgroundColor: (blockedUsers || []).includes(selectedUser?.username) ? '#10b981' : '#ef4444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>{(blockedUsers || []).includes(selectedUser?.username) ? 'Unblock User' : 'Block User'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showThemeModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '420px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'white', textAlign: 'center', fontSize: '20px' }}>Customize Chat Background</h2>
                        
                        {/* Preview Box */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Preview</div>
                            <div style={{ 
                                height: '110px', 
                                borderRadius: '16px', 
                                padding: '12px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '6px', 
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.05)',
                                boxSizing: 'border-box',
                                ...getThemeStyle(tempTheme, tempCustomBg)
                            }}>
                                <div style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: '12px 12px 12px 2px', backgroundColor: '#334155', color: 'white', fontSize: '11px', maxWidth: '80%' }}>
                                    Hey! How does this theme look?
                                </div>
                                <div style={{ alignSelf: 'flex-end', padding: '6px 12px', borderRadius: '12px 12px 2px 12px', backgroundColor: '#6366f1', color: 'white', fontSize: '11px', maxWidth: '80%' }}>
                                    Looks very premium! Let's apply it.
                                </div>
                            </div>
                        </div>

                        {/* Preset Themes */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Presets</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {['default', 'ocean', 'forest', 'sunset'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { setTempTheme(t); setTempCustomBg(''); }}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '12px',
                                            border: tempTheme === t ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                            backgroundColor: tempTheme === t ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontWeight: tempTheme === t ? 'bold' : 'normal',
                                            textTransform: 'capitalize',
                                            fontSize: '13px',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Image Upload */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Custom Background</div>
                            <button
                                type="button"
                                onClick={() => document.getElementById('themeBgInput').click()}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: tempTheme === 'custom' ? '2px solid #6366f1' : '1px dashed rgba(255,255,255,0.2)',
                                    backgroundColor: tempTheme === 'custom' ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: '#818cf8',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '13px',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                🖼️ {tempCustomBg ? "Change Custom Image" : "Choose Image from Device"}
                            </button>
                            <input type="file" id="themeBgInput" style={{ display: 'none' }} accept="image/*" onChange={handleThemeBgUpload} />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button 
                                type="button"
                                onClick={() => setShowThemeModal(false)} 
                                style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setChatTheme(tempTheme);
                                    setCustomBg(tempCustomBg);
                                    setShowThemeModal(false);
                                }} 
                                style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#6366f1', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {contextMenuMessageId && (
                <div 
                    onClick={() => setContextMenuMessageId(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease-out' }}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                            backgroundColor: '#1e293b', 
                            padding: '24px', 
                            borderRadius: '24px', 
                            width: '90%', 
                            maxWidth: '360px', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Title & Preview */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Message Actions</div>
                            <div style={{ 
                                fontSize: '13px', 
                                color: '#e2e8f0', 
                                backgroundColor: '#0f172a', 
                                padding: '12px 16px', 
                                borderRadius: '12px', 
                                display: 'inline-block',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontStyle: 'italic',
                                border: '1px solid rgba(255,255,255,0.02)'
                            }}>
                                "{messages.find(m => m._id === contextMenuMessageId)?.text || "Image Message"}"
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Copy Text Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    const msgText = messages.find(m => m._id === contextMenuMessageId)?.text || "";
                                    navigator.clipboard.writeText(msgText);
                                    alert("Message copied to clipboard!");
                                    setContextMenuMessageId(null);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    borderRadius: '12px',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                            >
                                📋 Copy Message
                            </button>

                            {/* Select Option */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSelectionMode(true);
                                    setSelectedMessageIds([contextMenuMessageId]);
                                    setContextMenuMessageId(null);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    borderRadius: '12px',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                            >
                                ☑️ Select Message
                            </button>

                            {/* Forward Option */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMessageIds([contextMenuMessageId]);
                                    setContextMenuMessageId(null);
                                    setShowForwardModal(true);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: '#818cf8',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    borderRadius: '12px',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(129, 140, 248, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                            >
                                ➡️ Forward Message
                            </button>

                            {/* Delete Option */}
                            <button
                                type="button"
                                onClick={() => handleDeleteMessageClick(contextMenuMessageId)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    borderRadius: '12px',
                                    width: '100%',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'}
                            >
                                🗑️ Delete Message
                            </button>
                        </div>

                        {/* Cancel button */}
                        <button
                            type="button"
                            onClick={() => setContextMenuMessageId(null)}
                            style={{
                                marginTop: '20px',
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: '#334155',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showForwardModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box' }}>
                        <h2 style={{ marginTop: 0, color: 'white', fontSize: '20px', marginBottom: '20px', textAlign: 'center' }}>Forward {selectedMessageIds.length} Messages To...</h2>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Groups</div>
                            {(groups || []).length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 14px' }}>No groups found</div> : 
                                groups.map(g => (
                                    <div 
                                        key={g._id} 
                                        onClick={() => forwardMessages(g)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: 'white', transition: 'all 0.2s', marginBottom: '4px' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <span>👥 {g.name}</span>
                                    </div>
                                ))
                            }
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '15px', marginBottom: '10px', letterSpacing: '0.05em' }}>Friends</div>
                            {(friends || []).length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 14px' }}>No friends found</div> : 
                                friends.map(u => (
                                    <div 
                                        key={u.username} 
                                        onClick={() => forwardMessages(u)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: 'white', transition: 'all 0.2s', marginBottom: '4px' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <span>👤 {u.username}</span>
                                    </div>
                                ))
                            }
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowForwardModal(false)} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteOptionsModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '380px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', boxSizing: 'border-box', textAlign: 'center' }}>
                        <h2 style={{ marginTop: 0, color: 'white', fontSize: '20px', marginBottom: '10px' }}>Delete Message?</h2>
                        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
                            {onlyShowDeleteForMe ? "Delete the selected message(s) from your chat history?" : "Choose whether to delete the selected message(s) for yourself or for everyone."}
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Delete for Everyone */}
                            {!onlyShowDeleteForMe && (
                                <button 
                                    type="button"
                                    onClick={() => performDelete('everyone')}
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}
                                >
                                    Delete for Everyone
                                </button>
                            )}

                            {/* Delete for Me */}
                            <button 
                                type="button"
                                onClick={() => performDelete('me')}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#334155', color: '#f8fafc', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                            >
                                Delete for Me
                            </button>

                            {/* Cancel */}
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowDeleteOptionsModal(false);
                                    setTargetDeleteIds([]);
                                }}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '5px' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCallActive && (
                <div 
                    onDoubleClick={isCallMinimized ? () => setIsCallMinimized(false) : undefined}
                    onTouchStart={isCallMinimized ? handleDoubleTap : undefined}
                    style={
                        isCallMinimized
                            ? {
                                position: 'fixed',
                                bottom: `${callPos.y}px`,
                                right: `${callPos.x}px`,
                                width: `${currentCallSize.width}px`,
                                height: `${currentCallSize.height}px`,
                                backgroundColor: '#1e293b',
                                borderRadius: '20px',
                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
                                zIndex: 10000,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                border: '2px solid rgba(255, 255, 255, 0.15)',
                                transition: isDragging ? 'none' : 'all 0.1s ease',
                                boxSizing: 'border-box'
                              }
                            : {
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(16px)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '60px 20px',
                                zIndex: 10000,
                                animation: 'fadeIn 0.3s ease-out',
                                boxSizing: 'border-box'
                              }
                    }
                >
                    {/* Fullscreen Top Minimize Button Overlay */}
                    {!isCallMinimized && (
                        <div style={{ 
                            position: 'absolute', 
                            top: 'calc(16px + env(safe-area-inset-top, 0px))', 
                            left: '20px', 
                            right: '20px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            zIndex: 10 
                        }}>
                            <button
                                type="button"
                                onClick={() => setIsCallMinimized(true)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: 'white',
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                                title="Minimize Call"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Minimized Drag Handle Bar */}
                    {isCallMinimized && (
                        <div 
                            onTouchStart={handleDragStart}
                            onMouseDown={handleDragStart}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '36px',
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 10px',
                                zIndex: 10,
                                cursor: 'move',
                                userSelect: 'none',
                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <button 
                                onClick={() => setIsCallMinimized(false)}
                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', outline: 'none' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <polyline points="9 21 3 21 3 15"></polyline>
                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                </svg>
                            </button>
                            
                            <div style={{ display: 'flex', gap: '3px' }}>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)' }}></div>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)' }}></div>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)' }}></div>
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); setCallSizeIndex(prev => (prev + 1) % 3); }}
                                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '12px', fontWeight: '800', cursor: 'pointer', padding: '4px', outline: 'none' }}
                                title="Toggle Size"
                            >
                                {callSizeIndex === 0 ? 'S' : callSizeIndex === 1 ? 'M' : 'L'}
                            </button>
                        </div>
                    )}
                    
                    {/* Top Call Info */}
                    {!isCallMinimized && (
                        <div style={{ textAlign: 'center', marginTop: '40px', zIndex: 2, position: 'relative' }}>
                            <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                                {callStatus === 'Ringing...' && callRole === 'callee' 
                                    ? `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call` 
                                    : `${callType === 'video' ? 'Video' : 'Voice'} Call`}
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'white', margin: '0 0 6px 0' }}>
                                {callPartnerName}
                            </h2>
                            <div style={{ fontSize: '15px', color: callStatus === 'Connected' ? '#10b981' : '#94a3b8', fontWeight: '500' }}>
                                {callStatus === 'Connected' ? `Connected • ${formatCallTime(callSeconds)}` : callStatus}
                            </div>
                        </div>
                    )}

                    {/* Glowing pulsate avatar OR Video elements */}
                    {callType === 'video' ? (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 1 }}>
                            {/* Remote Video (takes up full container when connected, always mounted) */}
                            <video 
                                ref={remoteVideoRef} 
                                autoPlay 
                                playsInline 
                                autoPictureInPicture={true}
                                style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover', 
                                    display: isRemoteVideoActive ? 'block' : 'none',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    zIndex: 1
                                }} 
                            />

                            {/* Local Video (Always mounted: full screen when calling/connecting, Pip thumbnail in the corner when connected) */}
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                style={
                                    isRemoteVideoActive 
                                        ? { 
                                            position: 'absolute', 
                                            top: isCallMinimized ? '8px' : '24px', 
                                            right: isCallMinimized ? '8px' : '24px', 
                                            width: isCallMinimized ? '35px' : '110px', 
                                            height: isCallMinimized ? '50px' : '160px', 
                                            borderRadius: isCallMinimized ? '6px' : '12px', 
                                            overflow: 'hidden', 
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                            border: isCallMinimized ? '1px solid rgba(255,255,255,0.2)' : '2px solid rgba(255,255,255,0.2)',
                                            zIndex: 2,
                                            backgroundColor: '#1e293b',
                                            objectFit: 'cover', 
                                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
                                          }
                                        : { 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: 'cover', 
                                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            zIndex: 1
                                          }
                                } 
                            />
                        </div>
                    ) : (
                        /* Voice call avatar display */
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                            {/* Glow rings */}
                            {/* Glow rings */}
                            {!isCallMinimized && (
                                <>
                                    <div className="call-ring" style={{ position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', border: '2px solid rgba(99, 102, 241, 0.2)', animation: 'pulseRing 2s infinite' }} />
                                    <div className="call-ring" style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', border: '2px solid rgba(99, 102, 241, 0.3)', animation: 'pulseRing 2s infinite 0.5s' }} />
                                </>
                            )}
                            
                            <div style={{ 
                                width: isCallMinimized ? '60px' : '140px', 
                                height: isCallMinimized ? '60px' : '140px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: isCallMinimized ? '24px' : '60px',
                                fontWeight: 'bold',
                                color: 'white',
                                border: isCallMinimized ? '2px solid #334155' : '4px solid #334155',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                overflow: 'hidden',
                                zIndex: 2
                            }}>
                                {callPartnerPic ? (
                                    <img src={callPartnerPic} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    callPartnerName ? callPartnerName[0].toUpperCase() : '?'
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bottom Control Bar */}
                    {callStatus === 'Ringing...' && callRole === 'callee' ? (
                        /* Incoming Call Controls */
                        <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', width: '100%', marginBottom: '40px', zIndex: 2, position: 'relative' }}>
                            {/* Decline Button */}
                            <button
                                type="button"
                                onClick={() => endVoiceCall(true)}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)',
                                    transition: 'transform 0.2s',
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </button>

                            {/* Accept Button */}
                            <button
                                type="button"
                                onClick={acceptCall}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)',
                                    transition: 'transform 0.2s',
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </button>
                        </div>
                    ) : isCallMinimized ? (
                        <div style={{ 
                            position: 'absolute', 
                            bottom: '12px', 
                            left: 0, 
                            right: 0, 
                            display: 'flex', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            zIndex: 10 
                        }}>
                            {/* Compact Mute Button */}
                            <button
                                type="button"
                                onClick={toggleCallMute}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: isCallMuted ? 'white' : 'rgba(15, 23, 42, 0.6)',
                                    color: isCallMuted ? '#0f172a' : 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    outline: 'none'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {isCallMuted ? (
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M1 1l22 22" />
                                    ) : (
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2" />
                                    )}
                                </svg>
                            </button>

                            {/* Compact Hang Up Button */}
                            <button
                                type="button"
                                onClick={() => endVoiceCall(true)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    outline: 'none'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-5.33-5.34A19.79 19.79 0 0 1 3 2.18 2 2 0 0 1 5 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 7.91a16 16 0 0 0 2.6 3.4z" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        /* Active/Outgoing Call Controls */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', marginBottom: '40px', width: '100%', zIndex: 2, position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
                                {/* Mute Button */}
                                <button
                                    type="button"
                                    onClick={toggleCallMute}
                                    style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        backgroundColor: isCallMuted ? 'white' : 'rgba(255,255,255,0.08)',
                                        color: isCallMuted ? '#0f172a' : 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    </svg>
                                </button>

                                {/* Camera Toggle Button (Only for Video Calls) */}
                                {callType === 'video' && (
                                    <button
                                        type="button"
                                        onClick={toggleCamera}
                                        style={{
                                            width: '54px',
                                            height: '54px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: isCameraOn ? 'rgba(255,255,255,0.08)' : 'white',
                                            color: isCameraOn ? 'white' : '#0f172a',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                        }}
                                    >
                                        {isCameraOn ? (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                        ) : (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.83 5H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.17l1.66-2.5A2 2 0 0 1 8.5 1h7a2 2 0 0 1 1.66 1.5L18.83 5z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        )}
                                    </button>
                                )}

                                {/* Rotate Camera Button (Only for Video Calls and when connected) */}
                                {callType === 'video' && callStatus === 'Connected' && (
                                    <button
                                        type="button"
                                        onClick={switchCamera}
                                        style={{
                                            width: '54px',
                                            height: '54px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: 'rgba(255,255,255,0.08)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                        }}
                                        title="Switch Camera"
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                        </svg>
                                    </button>
                                )}

                                {/* Minimize Picture-in-Picture Button (Only for Video Calls and when connected) */}
                                {callType === 'video' && callStatus === 'Connected' && document.pictureInPictureEnabled && (
                                    <button
                                        type="button"
                                        onClick={triggerPiP}
                                        style={{
                                            width: '54px',
                                            height: '54px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: 'rgba(255,255,255,0.08)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                        }}
                                        title="Minimize to Floating Window (PiP)"
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="8" y="8" width="14" height="10" rx="2" ry="2"></rect>
                                            <path d="M4 16H2v-2h2zm0-4H2v-2h2zm0-4H2V6h2zm18 0h-2V6h2zM6 6H4v2h2zm4 0H8v2h2zm4 0h-2v2h2zm4 0h-2v2h2z"></path>
                                        </svg>
                                    </button>
                                )}

                                {/* Speaker Button (Only for Voice Calls) */}
                                {callType === 'audio' && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCallSpeaker(!isCallSpeaker)}
                                        style={{
                                            width: '54px',
                                            height: '54px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            backgroundColor: isCallSpeaker ? 'white' : 'rgba(255,255,255,0.08)',
                                            color: isCallSpeaker ? '#0f172a' : 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                        }}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* End Call Button */}
                            <button
                                type="button"
                                onClick={() => endVoiceCall(true)}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)',
                                    transition: 'transform 0.2s',
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Hidden Audio Player for Remote Stream (Only used in Voice Calls) */}
                    {callType === 'audio' && <audio ref={remoteAudioRef} autoPlay playsInline />}

                    {/* Ring Animations style */}
                    <style>{`
                        @keyframes pulseRing {
                            0% { transform: scale(0.95); opacity: 0.8; }
                            100% { transform: scale(1.4); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}
            <style>{` @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } } `}</style>
        </div>
    );
};

export default Chat;
