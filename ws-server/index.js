const http= require('http');
const server= require('websocket').server;

const httpServer = http.createServer(()=>{});

httpServer.listen(1337, ()=> {
    console.log('Server is listening at port 1337');
});

const wsServer = new server({
    httpServer,
});

let peersByCode = {};

wsServer.on('request', request =>{
    const connection = request.accept();
    const id = Math.random().toString(36).substring(2,15) + Math.random().toString().substring(2, 15);

    connection.on('message', message => {
        const { code } = JSON.parse(message.utf8Data);
        if (!peersByCode[code]){
            peersByCode[code] = [{ connection, id }];
        } else if (!peersByCode[code].find(peer => peer.id === id)){
            peersByCode[code].push({connection, id});
        }

        const peer = peersByCode[code].find(peer => peer.id !== id);
        if (peer){
            peer.connection.send(message.utf8Data);
        }
    });

    // connection.on('close', () => {
    //     clients = clients.filter(client => client.id !== id);
    //     clients.forEach(client => client.connection.send(JSON.stringify({
    //         client: id,
    //         text: 'I disconnected',
    //     })));
    // });
});