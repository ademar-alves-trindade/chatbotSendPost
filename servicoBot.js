const makeWaSocket = require('@adiwajshing/baileys').default;
const { delay, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const P = require('pino');
const { unlink, existsSync, mkdirSync, readFileSync } = require('fs');
const express = require('express');
const { body, validationResult } = require('express-validator');
const http = require('http');
const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const BOTPath = './BOTSessions/';
const BOTAuth = 'auth_info.json';
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

const BOTUpdate = (BOTSock) => {
   BOTSock.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr){
         console.log('© BOT-RISC - Qrcode WhatsApp: ', qr);
      };
      if (connection === 'close') {
         const BOTReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
         if (BOTReconnect) BOTConnection()
         console.log('© BOT-RISC - CONEXÃO FECHADA! RAZÃO: ' + DisconnectReason.loggedOut.toString());
         if (BOTReconnect === false) {
            const removeAuth = BOTPath + BOTAuth
            unlink(removeAuth, err => {
               if (err) throw err
            })
         }
      }
      if (connection === 'open'){
         console.log('© BOT-RISC - CONECTADO!')
      }
   })
}

const BOTConnection = async () => {
   const { version } = await fetchLatestBaileysVersion()
   if (!existsSync(BOTPath)) {
      mkdirSync(BOTPath, { recursive: true });
   }
   const { saveState, state } = useSingleFileAuthState(BOTPath + BOTAuth)
   const config = {
      auth: state,
      logger: P({ level: 'error' }),
      printQRInTerminal: true,
      version,
      connectTimeoutMs: 60_000,
      async getMessage(key) {
         return { conversation: 'botrisc' };
      },
   }
   const BOTSock = makeWaSocket(config);
   BOTUpdate(BOTSock.ev);
   BOTSock.ev.on('creds.update', saveState);

   const BOTSendMessage = async (idTel, msg) => {
      await BOTSock.presenceSubscribe(idTel)
      await delay(2000)
      await BOTSock.sendPresenceUpdate('composing', idTel)
      await delay(1500)
      await BOTSock.sendPresenceUpdate('paused', idTel)
      return await BOTSock.sendMessage(idTel, msg)
   }

   // Send message
   app.post('/bot-message', [
      body('idTel').notEmpty(),
      body('message').notEmpty(),
   ], async (req, res) => {
      const errors = validationResult(req).formatWith(({
      msg
      }) => {
      return msg;
      });
      if (!errors.isEmpty()) {
      return res.status(422).json({
         status: false,
         message: errors.mapped()
      });
      }
   
      const idTel = req.body.idTel;
      const numberDDI = idTel.substr(0, 2);
      const numberDDD = idTel.substr(2, 2);
      const numberUser = idTel.substr(-8, 8);
      const message = req.body.message;

      if (numberDDI !== '55') {
         BOTSendMessage(idTel, { text: message }).then(response => {
            res.status(200).json({
               status: true,
               response: response
            });
            }).catch(err => {
            res.status(500).json({
               status: false,
               response: err
            });
            });
      }
      if (numberDDI === '55' && numberDDD <= 30) {
         const numberBot = "55" + numberDDD + "9" + numberUser + "@s.whatsapp.net";
         BOTSendMessage(numberBot, { text: message }).then(response => {
            res.status(200).json({
               status: true,
               response: response
            });
            }).catch(err => {
            res.status(500).json({
               status: false,
               response: err
            });
            });
      }
      if (numberDDI === '55' && numberDDD > 30) {
         const numberBot = "55" + numberDDD + numberUser + "@s.whatsapp.net";
         BOTSendMessage(numberBot, { text: message }).then(response => {
            res.status(200).json({
               status: true,
               response: response
            });
            }).catch(err => {
            res.status(500).json({
               status: false,
               response: err
            });
            });
      }

   });
}

BOTConnection()

server.listen(port, function() {
   console.log('© BOT-RISC - Servidor rodando na porta: ' + port);
 });