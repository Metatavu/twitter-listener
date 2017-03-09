(function () {
  'use strict';

  const request = require('request');
  const Twitter = require('twitter');
  const util = require('util');
  const config = require(__dirname + '/config.json');
  const commandLineArgs = require('command-line-args');

  const optionDefinitions = [
    { name: 'url', alias: 'u', type: String },
    { name: 'tags', alias: 't', type: String, multiple: true }
  ];

  const options = commandLineArgs(optionDefinitions);

  const client = new Twitter({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token_key: config.twitter.access_token_key,
    access_token_secret: config.twitter.access_token_secret
  });

  client.stream('statuses/filter', { track: options.tags.join(',') }, stream => {
    stream.on('data', tweet => {
      console.log(util.format('Received tweet with text: %s', tweet.text));
      var url = util.format('%s?message=%s', options.url, encodeURIComponent(tweet.text));
      request(url, (error, response, body) => {
        if(error) {
          console.error(error);
        } else {
          console.log(util.format('Received [%s] %s from %s', response.statusCode, body, url));
        }
      });
    });

    stream.on('error', error => {
      console.error(error);
    });
  });

})();