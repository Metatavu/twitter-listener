/*jshint esversion: 6 */
/* global __dirname */

(function () {
  'use strict';

  const request = require('request');
  const Twitter = require('twitter');
  const util = require('util');
  const config = require(__dirname + '/config.json');
  const express = require('express');
  const app = express();
  const http = require('http').Server(app);
  const bodyParser = require('body-parser');
  const commandLineArgs = require('command-line-args');

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb'}));

  const optionDefinitions = [
    { name: 'url', alias: 'u', type: String },
    { name: 'port', alias: 'p', type: Number },
    { name: 'tags', alias: 't', type: String, multiple: true }
  ];

  const options = commandLineArgs(optionDefinitions);

  const client = new Twitter({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token_key: config.twitter.access_token_key,
    access_token_secret: config.twitter.access_token_secret
  });

  var stream = client.stream('statuses/filter', { track: options.tags.join(',') });

  stream.on('data', tweet => {
    console.log(util.format('Received tweet with text: %s', tweet.text));
    sendPingToMachine(tweet.text);
  });
  
  stream.on('error', error => {
    console.error(error);
    stream = client.stream('statuses/filter', { track: options.tags.join(',') });
  });
  
  stream.on('end', () => {
    console.error('Stream ended');
    stream = client.stream('statuses/filter', { track: options.tags.join(',') });
  });

  app.get('/fbping', (req, res) => {
    var challenge = req.query['hub.challenge'];
    console.log(challenge);
    res.send(challenge);
  });
  
  app.post('/fbping', (req, res) => {
    var entries = req.body.entry;
    if (entries && entries.length > 0) {
      for (let i = 0; i < entries.length; i++) {
        var changes = entries[i].changes;
        for (let j = 0; j < changes.length; j++) {
          var changeValue = changes[j].value;
          if (changeValue && changeValue.verb == 'add' && changeValue.message) {
            for (let n = 0; n < options.tags.length; n++) {
              var tag = options.tags[n];
              if (changeValue.message.includes('#' + tag)) {
                console.log('Received webhook with message ' + changeValue.message);
                sendPingToMachine(changeValue.message);
                break;
              }
            }
          }
        }
        
      }
    }
    
    res.send('ok');
  });
  
  http.listen(options.port, function () {
    console.log(util.format('Listening to %s', options.port));
  });

  function sendPingToMachine(message) {
    var url = util.format('%s?message=%s', options.url, encodeURIComponent(message));
    request(url, (error, response, body) => {
      if(error) {
        console.error(error);
      } else {
        console.log(util.format('Received [%s] %s from %s', response.statusCode, body, url));
      }
    });
  }

})();