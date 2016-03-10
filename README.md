# icrawler

Tool for easy scraping data from websites

[![NPM version][npm-image]][npm-url]

## Features

- Clean and simple API
- Persistent error-proof crawling
- jQuery-like server-side DOM parsing with Cheerio
- Parallel requests
- Proxy list support
- HTTP auth and cookie forwarding
- Automatic charset detection and conversion
- Console progress indicator
- node 0.10 and 0.12 support

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
    - `cookieSource` - URL to get cookies from. It's possible to use RFC-1738 basic auth like this: `'http://user:pass@server.com'`.
    - `concurrency` - number of parallel requests. Defaults to 1. If `cookieSource` set - `concurrency` option will be ignored.
    - `delay` - time in milisecs to wait on error before try to crawle again. Defaults to 10000 (10 secs).
    - `skipDuplicates` - if `true` parse every URL only once. Defaults to `false`.
    - `decode_response` - (or `decode`) Whether to decode the text responses to UTF-8, if Content-Type header shows a different charset. Defaults to true.
    - `open_timeout` (or `timeout`) - Returns error if connection takes longer than X milisecs to establish. Defaults to 10000 (10 secs). 0 means no timeout.
    - `read_timeout` - Returns error if data transfer takes longer than X milisecs, after connection is established. Defaults to 0 (no timeout).
    - `proxy` - Forwards request through HTTP(s) proxy. Eg. `proxy: 'http://user:pass@proxy.server.com:3128'`. If array of strings - use random proxy from list for every request.
    - `headers` - Object containing custom HTTP headers for request. Overrides defaults described below.
    - `cookies` - Sets a `{key: 'val'}` object as a 'Cookie' header.
    - `connection` - Sets 'Connection' HTTP header. Defaults to close.
    - `user_agent` - Sets the 'User-Agent' HTTP header. Defaults to Needle/{version} (Node.js {nodeVersion}).
- **`parse`** - page-parsing `function(url, $, _)` , that runs for every crawled page and gets this params:
    - `url` - url of parsed page
    - `$` - jQuery-like (`cheerio` powered) object for parsed page
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
    skipDuplicates: true
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

## License

MIT

[npm-url]: https://npmjs.org/package/icrawler
[npm-image]: https://badge.fury.io/js/icrawler.svg