require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const moment = require('moment');
const momentTZ = require('moment-timezone');
const OrderModal = require('./models/merchantOrder');
const merchantOrderController = require('./controller/merchantOrder');


const port = process.env.PORT || 4008;
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});
const paymentClients = new Map();
const orderTimers = {};
io.on('connection', async (socket) => {
    console.log(`on connection to the socket`);
    const paymentId = socket.handshake.query.paymentId;
    console.log(paymentId);
    const created_at = socket.handshake.query.created_at;
    console.log(created_at);
    const mode = socket.handshake.query.mode;

    // let order_table = mode == "test" ? "test_orders" : "orders";
    // let response = await OrderModal.selectOne("created_at, status", {order_id: paymentId}, order_table);

    // Add 10 minutes (600,000 milliseconds)
    const expirationTime = momentTZ(created_at).tz('Etc/GMT').add(10, 'minutes');
    const now = momentTZ.tz('Etc/GMT');
    const diffMs = expirationTime.diff(now);

    let minutes_left = 0;
    let seconds_left = 0;
    let expiryTime = 0;
    if (diffMs > 0) {
        expiryTime = diffMs;
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        minutes_left = minutes;
        seconds_left = seconds;
        console.log(`⌛ Time left: ${minutes}m ${seconds}s`);
    } else {
        console.log("⛔ Expired");
    }

    if (paymentId) {
        paymentClients.set(paymentId, socket.id);
        console.log(`User watching payment ${paymentId}`);
    }
    socket.join(paymentId);

    io.to(paymentId).emit("orderLeft", { paymentId, created_at, mode, minutes_left, seconds_left});

    // For demo: assume order is valid for 5 minutes
    // const expiryTime = 10 * 60 * 1000; // 5 minutes

    // Prevent multiple timers for same order
    if (!orderTimers[paymentId]) {
      orderTimers[paymentId] = setTimeout(async () => {
        await merchantOrderController.updateStatusOfExpiredOrder(paymentId, mode);
        io.to(paymentId).emit("orderExpired", { paymentId, created_at, mode});
        delete orderTimers[paymentId];
        console.log(`Order ${paymentId} expired`);
      }, expiryTime);
    }

    socket.on('disconnect', () => {
        for (const [id, sid] of paymentClients.entries()) {
            if (sid === socket.id) paymentClients.delete(id);
        }
    });
});
app.post('/api/v1/mobile-payment/update-status', (req, res) => {
    console.log(`the payload recieved from webhook`);
    console.log(req.body)
    const payload = req.body;
    const paymentId = payload.externalId; // or however you identify it

    const socketId = paymentClients.get(paymentId);
    if (socketId) {
        io.to(socketId).emit('payment-confirmed', payload);
        console.log(`Confirmed payment for ${paymentId}`);

        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
            clientSocket.disconnect(true); // Force disconnect
            console.log(`Disconnected socket for payment ${paymentId}`);
        }

        paymentClients.delete(paymentId); // Cleanup map
    }

    res.sendStatus(200);
});
//debug the issue
server.listen(port, process.env.SERVER_ADDR);
console.log(process.env.SERVER_ADDR + ':' + port);

