(function(){
    "use strict";

    
    const MESSAGE_TYPE = {
        SDP: 'SDP',
        CANDIDATE: 'CANDIDATE',
    }

    let code;
    let peerConnection;
    let signalling;
    const senders = [];
    let userMediaStream;
    let displayMediaStream;
    
    document.getElementById('code-input').addEventListener('input', async(event) => {
        const { value } = event.target;
        if (value.length > 8){
            document.getElementById('start-button').disabled = false;
            code = value;
        }else {
            document.getElementById('start-button').disabled = true;
            code = null;
        }
    });

    document.getElementById('start-button').addEventListener('click', async (event) => {
        if (code){
            startChat();
        }
    });

    const startChat = async () => {
        try {
            userMediaStream = await navigator.mediaDevices.getUserMedia({audio:true, video:true});
            showChatRoom();

            signalling = new WebSocket('ws://127.0.0.1:1337');
            peerConnection = createPeerConnection(signalling);

            addMessageHandler();

            userMediaStream.getTracks()
                .forEach(track => senders.push(peerConnection.addTrack(track, userMediaStream)));
            document.getElementById('self-view').srcObject = userMediaStream;
        }catch(err){
            console.log(err);
        }
    };

    const createPeerConnection = (signalling) =>{
        const pc = new RTCPeerConnection({
            iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
        });

        pc.onnegotiationneeded = async() => {
            await createAndSendOffer();
        }

        pc.onicecandidate = (iceEvent) => {
            if (iceEvent && iceEvent.candidate){
                sendMessage({
                    message_type: MESSAGE_TYPE.CANDIDATE,
                    content: iceEvent.candidate,
                });
            }
        };

        pc.ontrack = (event) => {
            const video = document.getElementById('remote-view');
            video.srcObject = event.streams[0];
        };
        return pc;
    };

    const addMessageHandler = () => {
        signalling.onmessage = async(message) => {
            const data = JSON.parse(message.data);

            if (!data){
                return;
            }

            const {message_type, content} = data;

            try{
                if (message_type === MESSAGE_TYPE.CANDIDATE && content){
                    await peerConnection.addIceCandidate(content);
                }else if (message_type === MESSAGE_TYPE.SDP){
                    if (content.type === 'offer'){
                        await peerConnection.setRemoteDescription(content);
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        sendMessage(signalling, {
                            message_type: MESSAGE_TYPE.SDP, 
                            content:answer,
                        });
                    }else if (content.type === 'answer'){
                        await peerConnection.setRemoteDescription(content);
                    }else {
                        console.log('Unsupported SDP type');
                    }
                }
            }catch(err){
                console.log(err);
            }
        };
    };

    const sendMessage = (message) => {
        if (code){
            signalling.send(JSON.stringify({
                ...message,
                code,
            }));
        }
    };

    const createAndSendOffer = async () => {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendMessage({
            message_type: MESSAGE_TYPE.SDP,
            content: offer,
        });
    };

    const showChatRoom = () => {
        document.getElementById('start').style.display = 'none';
        document.getElementById('chat-room').style.display = 'block';
    };

    document.getElementById('share-button').addEventListener('click', async() => {
        if (!displayMediaStream){
            displayMediaStream = await navigator.mediaDevices.getDisplayMedia();
        }
        senders.find(sender => sender.track.kind === 'video').replaceTrack(displayMediaStream.getTracks()[0]);

        document.getElementById('self-view').srcObject = displayMediaStream;

        document.getElementById('share-button').style.display = 'none';
        document.getElementById('stop-share-button').style.display = 'inline'
    });

    document.getElementById('stop-share-button').addEventListener('click', async(event) => {
        senders.find(sender => sender.track.kind === 'video')
            .replaceTrack(userMediaStream.getTracks().find(track => track.kind === 'video'));
        document.getElementById('self-view').srcObject = userMediaStream;
        document.getElement('share-button').style.display = 'inline';
        document.getElementById('stop-share-button').style.display = 'none';
    });
})();