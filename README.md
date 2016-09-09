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
- node from 0.10 to 6.0 support

## Install

```bash
npm install icrawler
```

## Usage

```js
icrawler(startData, opts, parse, done);
```

- **`startData`** - task for start crawling (or array of tasks). Single icrawler task can be url (of page or API resource) or object with `url` field for url. Optionaly you can use `data` field with object for `POST` request (default method is `GET`). You can use any other fields for custom data. For example, you can mark different types of tasks for parsing different ways, or you can store in task partial data, when one result record needs more than one requests.
- **`opts`** (optional) - options:
    - `concurrency` - positive number of parallel requests or negative number of milisecs of delay between requests with no parallelism. Defaults to 1.
    - `delay` - time in milisecs to wait on error before try to crawle again. Defaults to 10000 (10 secs).
    - `errorsFirst` - if `true` failed requests will repeated before all others. if `false` - it will pushed in tail of queue. Defaults to `false`.
    - `allowedStatuses` - number or array of numbers of HTTP response codes that are not errors. Defaults to [200].
    - `skipDuplicates` - if `true` parse every URL only once. Defaults to `true`.
    - `objectTaskParse` - if `true` task object will sent to `parse` instead url string. Defaults to `false`.
    - `decode_response` - (or `decode`) Whether to decode the text responses to UTF-8, if Content-Type header shows a different charset. Defaults to true.
    - `noJquery` - if `true` send response body string to `parse` function (as `$` parameter) as is, without jQuery-like parsing. Defaults to `false`.
    - `noResults` - if `true` don't save parsed items to results array (no `save` field in `_` parameter of `parse` function). Defaults to `false`.
    - `quiet` - if `true` don't write anything to console. No `log` and `step` fields in `_` parameter of `parse` function. Defaults to `false`.
    - `open_timeout` (or `timeout`) - Returns error if connection takes longer than X milisecs to establish. Defaults to 10000 (10 secs). 0 means no timeout.
    - `read_timeout` - Returns error if data transfer takes longer than X milisecs, after connection is established. Defaults to 10000 milisecs (not like in needle).
    - `proxy` - Forwards request through HTTP(s) proxy. Eg. `proxy: 'http://user:pass@proxy.server.com:3128'`. If array of strings - use proxies from list.
    - `proxyRandom` - if `true` use random proxy from list for every request; if `false` after each error use new proxy from list. Defaults to `true`. If `proxy` is not array - `proxyRandom` option will be ignored.
    - `headers` - Object containing custom HTTP headers for request. Overrides defaults described below.
    - `cookies` - Sets a `{key: 'val'}` object as a 'Cookie' header.
    - `connection` - Sets 'Connection' HTTP header. Defaults to close.
    - `user_agent` - Sets the 'User-Agent' HTTP header. If array of strings - use 'User-Agent' header from list. Defaults to Needle/{version} (Node.js {nodeVersion}).
    - `agentRandom` - if `true` use random 'User-Agent' from list for every request; if `false` after each error use new 'User-Agent' from list. Defaults to `true`. If `user_agent` is not array - `agentRandom` option will be ignored.
    - `init` - `function (needle, log, callback)` for preparing cookies and headers for crawling. Must run `callback(err)` if errors or `callback(null, cookies, headers)` if success.
    - `initOnError` - if `true` run `init` on every resume after errors. If `false` run `init` only on start. If `init` is not set - `initOnError` option will be ignored. Defaults to `true`.
    - `cleanCookiesOnInit` - if `true` clean old cookies on `init` run. Defaults to `false`.
    - `cleanHeadersOnInit` - if `true` clean old headers on `init` run. Defaults to `false`.
    - `save` - `function (tasks, results)` for saving crawler state. `tasks` is object containing arrays `waiting`, `finished` and `failed` with tasks from queue. `results` is array of already fetched data. Ignored if `file` set.
    - `results` - results saved by `save` for continue crawling after crash or manual break. Ignored if `file` set.
    - `tasks` - tasks saved by `save` for continue crawling after crash or manual break. `tasks` is object containing arrays `waiting`, `finished` and `failed`. Ignored if `file` set.
    - `file` - name of file for saving crawler state for continue crawling after crash or manual break. Use it instead `save`, `tasks` and `results` for auto saving.
    - `saveOnError` - if `true` runs `save` every time when paused on error.  Defaults to `true`.
    - `saveOnFinish` - if `true` runs `save` when crawling finished. Defaults to `true`.
    - `saveOnExit` - if `true` runs `save` when user abort script by `Ctrl+C`. Defaults to `true`.
    - `saveOnCount` - if number runs `save` every `saveOnCount` requests.
    - `asyncParse` - if `true` - runs `parse` in asynchronous mode. Defaults to `false`.
- **`parse`** - page-parsing `function(task, $, _, res)` , that runs for every crawled page and gets this params:
    - `task` - url of parsed page. If set `objectTaskParse` then `task` is object with `url` property.
    - `$` - jQuery-like (`cheerio` powered) object for html page or parsed object for `json` or raw response body if `noJquery` is `true`.
    - `_` - object with four functions:
      - `_.push(task)` - adds new task (or array of tasks) to crawler queue (will be parsed later). Every task can be url string or object with `url` property.
      - `_.save(item)` - adds parsed item to results array
      - `_.step()` - increment indicator
      - `_.log(message /*, ... */)` - safe logging (use it instead `console.log`)
      - `_.cb` - callback function for asynchronous mode. Is undefined if `asyncParse` is `false`.
    - `res` (optional) - full response object (`needle` powered).
- **`done`** (optional) - `function(result)`, that runs once with result of crawling/parsing

## Example

```js
var icrawler = require('icrawler');

var opts = {
    concurrency: 10,
    errorsFirst: true
};

icrawler('http://example.com/', opts, function(url, $, _){
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

## Some real life examples:

- [icrawler-ferra](https://gist.github.com/astur/d40bbb5a9b1b622bcb7b)
- [icrawler-lis](https://gist.github.com/astur/1cf671e668adb0a04e5d)

## License

MIT

[npm-url]: https://npmjs.org/package/icrawler
[npm-image]: https://badge.fury.io/js/icrawler.svg