var cheerio = require('cheerio');
var needle = require('needle');
var async = require('async');
var log = require('cllc')(module);

function filterOpts(opts){
    opts = Object.prototype.toString.call(opts).slice(8,-1) === 'Object' ? opts : {};
    var o = {_: {}};
    o.concurrency = opts.concurrency || 1;
    o.delay = opts.delay || 10000;
    o.skipDuplicates = !!(opts.skipDuplicates);
    o.errorsFirst = !!(opts.errorsFirst);

    o.proxyArray = ({String: [opts.proxy], Array: opts.proxy})[Object.prototype.toString.call(opts.proxy).slice(8,-1)];
    o.proxyRandom = !(opts.proxyRandom === false);

    o.agentArray = ({String: [opts.user_agent], Array: opts.user_agent})[Object.prototype.toString.call(opts.user_agent).slice(8,-1)];
    o.agentRandom = !(opts.agentRandom === false);

    if (opts.open_timeout || opts.timeout) {o._.open_timeout = opts.open_timeout || opts.timeout;}
    if (opts.read_timeout) {o._.read_timeout = opts.read_timeout;}

    o._.cookies = opts.cookies || {};
    o._.headers = opts.headers || {};
    if (opts.connection) {o._.connection = opts.connection;}
    if (opts.decode_response === false) {o._.decode_response = false;}

    return o;
}

module.exports = function(startURL, opts, parse, done){
    var result = [];
    var passed = {};
    if (typeof opts === 'function') {
        done = parse;
        parse = opts;
    }
    opts = filterOpts(opts);
    log.start('%s results found');

    function safePush(baseURL){
        return function (url, prior) {
            if (typeof url === 'string') {
                url = [url];
            }
            function _push(url){
                if (!url || typeof url !== 'string') {
                    return false;
                }
                if (baseURL && !/^http/i.test(url)) {
                    url = require('url').resolve(baseURL, url);
                }
                if (passed[url] !== true) {
                    passed[url] = true;
                    q[prior ? 'unshift' : 'push'](url);
                }
                return true;
            }
            while(_push(url.shift())){}
        };
    }

    function getFromArray(arr){
        var i = 0;
        return function(random){
            if (random) return arr[Math.floor(Math.random()*arr.length)];
            if (i >= arr.length) i = 0;
            return arr[i++];
        }
    }

    var getProxy = opts.proxyArray && getFromArray(opts.proxyArray);
    var getAgent = opts.agentArray && getFromArray(opts.agentArray);

    var q = async.queue(function(url, cb){
        if (opts.proxyArray) {
            opts._.proxy = opts.proxyRandom ? getProxy(true) : opts._.proxy || getProxy();
        }
        if (opts.agentArray) {
            opts._.user_agent = opts.agentRandom ? getAgent(true) : opts._.user_agent || getAgent();
        }
        needle.get(url, opts._, function(err, res){
            if (!err && res.statusCode === 200) {
                var $ = typeof res.body === 'string' ? cheerio.load(res.body) : res.body;
                parse(url, $, {
                    push: safePush(url),
                    save: function(v){result.push(v);},
                    step: log.step,
                    log: log
                }, res);
            } else {
                log.e(url);
                if (!q.paused) {
                    q.pause();
                    log.w('Paused!', new Date());
                    setTimeout(function(){
                        if (opts.proxyArray && !opts.proxyRandom) {
                            opts._.proxy = getProxy();
                        }
                        if (opts.agentArray && !opts.agentRandom) {
                            opts._.user_agent = getAgent();
                        }
                        q.resume();
                        log.i('Resumed!', new Date());
                    }, opts.delay);
                }
                q[opts.errorsFirst ? 'unshift' : 'push'](url);
            }
            cb();
        });
    }, opts.concurrency);

    q.drain = function(){
        log.finish();
        if (done) {
            done(result);
        }
    };

    safePush()(startURL);
};