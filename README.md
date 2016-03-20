# icrawler

Tool for easy scraping data from websites

[![NPM version][npm-image]][npm-url]

## Features

- Clean and simple API
- Persistent error-proof crawling
- State saving for continuous crawling
- jQuery-like server-side DOM parsing with Cheerio
- Parallel requests
- Proxy list and user-agent list support
- HTTP headers and cookies setup
- Automatic charset detection and conversion
- Console progress indicator
- node from 0.10 to 5.8 support

## Install

```bash
npm install icrawler
```

## Usage

```js
icrawler(startURL, opts, parse, done);
```

- **`startURL`** - URL of page for start crawling (or array of URLs).
- **`opts`** (optional) - options:
    - `concurrency` - number of parallel requests. Defaults to 1. If `cookieSource` set - `concurrency` option will be ignored.
    - `delay` - time in milisecs to wait on error before try to crawle again. Defaults to 10000 (10 secs).
    - `errorsFirst` - if `true` failed requests will repeated before all others. if `false` - it will pushed in tail of queue. Defaults to `false`.
    - `decode_response` - (or `decode`) Whether to decode the text responses to UTF-8, if Content-Type header shows a different charset. Defaults to true.
    - `open_timeout` (or `timeout`) - Returns error if connection takes longer than X milisecs to establish. Defaults to 10000 (10 secs). 0 means no timeout.
    - `read_timeout` - Returns error if data transfer takes longer than X milisecs, after connection is established. Defaults to 0 (no timeout).
    - `proxy` - Forwards request through HTTP(s) proxy. Eg. `proxy: 'http://user:pass@proxy.server.com:3128'`. If array of strings - use proxies from list.
    - `proxyRandom` - if `true` use random proxy from list for every request; if `false` after each error use new proxy from list. Defaults to `true`. If `proxy` is not array - `proxyRandom` option will be ignored.
    - `headers` - Object containing custom HTTP headers for request. Overrides defaults described below.
    - `cookies` - Sets a `{key: 'val'}` object as a 'Cookie' header.
    - `connection` - Sets 'Connection' HTTP header. Defaults to close.
    - `user_agent` - Sets the 'User-Agent' HTTP header. If array of strings - use 'User-Agent' header from list. Defaults to Needle/{version} (Node.js {nodeVersion}).
    - `agentRandom` - if `true` use random 'User-Agent' from list for every request; if `false` after each error use new 'User-Agent' from list. Defaults to `true`. If `user_agent` is not array - `agentRandom` option will be ignored.
    - `init` - `function (needle, log, callback)` for preparing cookies and headers for crawling. Must run `callback(err)` if errors or `callback(null, cookies, headers)` if success.
    - `save` - `function (tasks, results)` for saving crawler state (tasks in queue and already prepared results).
    - `saveOnError` - if `true` runs `save` every time when paused on error.  Defaults to `true`.
    - `saveOnFinish` - if `true` runs `save` when crawling finished. Defaults to `true`.
    - `saveOnCount` - if number runs `save` every `saveOnCount` requests.
    - `results` - results saved by `save` for continue crawling after crash or manual break.
- **`parse`** - page-parsing `function(url, $, _, res)` , that runs for every crawled page and gets this params:
    - `url` - url of parsed page
    - `$` - jQuery-like (`cheerio` powered) object for html page or parsed object for `json`
    - `_` - object with four functions:
      - `_.push(url)` - adds new url (or array of urls) to crawler queue (will be parsed later)
      - `_.save(item)` - adds parsed item to results array
      - `_.step()` - increment indicator
      - `_.log(message /*, ... */)` - safe logging (use it instead `console.log`)
    - `res` (optional) - full response object (`needle` powered).
- **`done`** (optional) - `function(result)`, that runs once with result of crawling/parsing

## Example

```js
var icrawler = require('icrawler');

var opts = {
    concurrency: 10,
    errorsFirst: true
};

icrawler(URL, opts, function(url, $, _){
    if($('#next').length > 0){
        _.push($('.next').attr('href'));
        _.log('PAGE');
    }
    $('.news>a').each(function() {
        _.step();
        _.save({
            title: $(this).text(),
            href: $(this).attr('href')
        })
    });
}, function(result){
    console.log(result);
});
```

## More complicated example

```js
var icrawler = require('icrawler');
var fs = require('fs');

var opts = {
    errorsFirst: true,
    concurrency: 30,
    saveOnCount: 500,
    init: function(needle, log, cb){
        needle.get(specialURL, {}, function(err, res){
            if (err) return cb(err);
            cb(null, res.cookies, {});
        });
    },
    save: function(tasks, results){
        fs.writeFileSync(
            './data.json',
            JSON.stringify({tasks: tasks, results: results}, null, 4)
        );
    },
    delay: 30000,
    agentRandom: false,
    user_agent: [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
        'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
        'Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16',
        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36',
    ],
    proxyRandom: false,
    proxy: [
        'http://117.135.250.130:8080',
        'http://117.135.250.132:8080',
        'http://117.135.251.133:8080',
        'http://117.135.251.132:8080',
    ],
};

if(fs.existsSync('./data.json')){
    var data = fs.readFileSync('./data.json', 'utf8');
    data = JSON.parse(data);
    if (data.tasks.length === 0) {
        console.log('All tasks done');
        process.exit(0);
    }
    URL = data.tasks;
    opts.results = data.results;
}

icrawler(URL, opts, function(url, $, _){
    if($('#next').length > 0){
        _.push($('.next').attr('href'));
        _.log('PAGE');
    }
    $('.news>a').each(function() {
        _.step();
        _.save({
            title: $(this).text(),
            href: $(this).attr('href')
        })
    });
}, function(result){
    console.log(result);
});
```

## License

MIT

[npm-url]: https://npmjs.org/package/icrawler
[npm-image]: https://badge.fury.io/js/icrawler.svg