var WebSocketServer = require("ws").Server

var http = require("http")
var express = require("express")
var app = express()
var port = process.env.PORT || 5000

var private_key = "9001a43f-c492-4950-8c57-33bb6f8f6e7d";

app.use(express.static(__dirname + "/"))

var server = http.createServer(app)
server.listen(port)

console.log("Http server listening on %d", port);

var wss = new WebSocketServer({server: server});
console.log("Websocket Server Created");


function urlParse(url) {
  // "/?id=5&partner=1&private_key=123123142234213"
  var preTokens = url.split('?');
  if((preTokens.length <= 1)){
    return false;
  }
  var tokens = (preTokens[1]).split('&');
  var params = {};
  var i = 0;
  for(i;i<tokens.length;i++){
      var param = tokens[i].split("=");
      if(param.length == 2)
          params[param[0]] = param[1];
  }
  return params;
};

var users = {};

/** 
*  Connection Occured
*  All Operations
*/
wss.on('connection', function (ws) {
  var tokens = urlParse(ws.upgradeReq.url);
  if(tokens.private_key !== private_key || tokens.private_key === undefined || !tokens){
    ws.close();
    return;
  }
  ws.id = tokens.id;
  ws.partner = tokens.partner;
  users[tokens.id] = ws;
  console.log('Online ', tokens.id); 
  //If partner was online for you, you can send to partner directly with ws, otherwise send to db
  if (users[ws.partner] != undefined) {
    var response = JSON.stringify({
      partner: true,
      for: ws.partner
    });
    ws.send(response);
    users[ws.partner].send(response);
  } else {
    ws.send(JSON.stringify({
      partner: false
    }));
  }

  for (var i in users) {
    if (users[i]['partner'] == ws.id) {
      users[i].send(JSON.stringify({
        partner: true,
        for: ws.partner
      }));
    }
  } //If partner is online for current user, send to partner


  ws.on('message', function (mes) {
    //Message Received By Server
    var message = JSON.parse(mes);
    console.log(message);

    if (users[ws.partner] === undefined) {
      console.log("Partner is offline");
      var _response = {
        "partner": false
      };
      ws.send(JSON.stringify(_response)); //Exactly save database
    } else {
      console.log("Partner is online");

      if (users[ws.partner]['partner'] === ws.id) {
        //Message.type == "typing"?Send to typing info
        console.log("Partner is online for you!!");
        users[ws.partner].send(mes); //Send to partner then save database
      } else {
        console.log("Partner is online for other!!");
        var _response2 = {
          "partner": true,
          for: ws.partner
        };
        ws.send(JSON.stringify(_response2)); //Do not send, save database
      }
    }
  });
  ws.on('close', function (res) {
    console.log(" Closed: ", res);

    if (users[ws.partner] != undefined && users[ws.partner]['partner'] == ws.id) {
        users[ws.partner].send(
          JSON.stringify({
          partner: false
        })
      );
    }

    for (var _i in users) {
      if (users[_i]['partner'] == ws.id) {
        users[_i].send(JSON.stringify({
          partner: false
        }));
      }
    }
    delete users[ws.id];
  });
});

/** Listening Started */
wss.on('listening', function () {
  console.log("Listening on port " + port + "...");
});
/** Error Occured */

wss.on('error', function (e) {
  console.log("Error Occured");
  console.log(e.message);
});