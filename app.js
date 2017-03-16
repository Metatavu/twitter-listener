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
  const MongoClient = require('mongodb').MongoClient;
  
  const FB = require('fb');
  const FB_POLL_INTERVAL = 5000;
  
  FB.setAccessToken(config.facebook.access_token);

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

  MongoClient.connect('mongodb://localhost:27017/sovend', (dbErr, db) => {
    if (dbErr) {
      console.error('Error connecting to the database', dbErr);
    } else {
      const collection = db.collection('tags');
  
      function handleFbTag(tag) {
        collection.count({tagId: tag.id}, (countErr, count) => {
          if (countErr) {
            console.error('Error counting tags', countErr);
          } else if (count < 1 && tag.message) {
            collection.insertOne({tagId: tag.id, message: tag.message}, (insertErr, savedTag) => {
              if (insertErr) {
                console.error('Error inserting tag to database', insertErr);
              } else {
                for (let n = 0; n < options.tags.length; n++) {
                  if (tag.message.includes('#' + options.tags[n])) {
                    console.log('Received tag with message ' + tag.message);
                    sendPingToMachine(tag.message);
                    break;
                  }
                } 
              }
            });
          }
        });
      }

      function createTwitterStream() {
        var stream = client.stream('statuses/filter', { track: options.tags.join(',') });

        stream.on('data', tweet => {
          console.log(util.format('Received tweet with text: %s', tweet.text));
          sendPingToMachine(tweet.text);
        });

        stream.on('error', error => {
          console.error(error);
          createTwitterStream();
        });

        stream.on('end', () => {
          console.error('Stream ended');
          createTwitterStream();
        });
      }

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
  
      createTwitterStream();

      setInterval(() => {
        FB.api('1732367617093210/tagged', function (res) {
          if (!res || res.error) {
            console.error(!res ? 'error occurred while getting tags from facebook' : res.error);
          } else {
            var data = res.data;
            if (data && data.length > 0) {
              for (let i = 0; i < data.length; i++) {
                handleFbTag(data[i]);
              }
            }
          }
        });
      }, FB_POLL_INTERVAL); 

      http.listen(options.port, function () {
        console.log(util.format('Listening to %s', options.port));
      });
    }
  });
})();