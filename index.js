var cheerio = require('cheerio');
var needle = require('needle');
var async = require('async');
var log = require('cllc')(module);

function filterOpts(opts){
    opts = Object.prototype.toString.call(opts).slice(8,-1) === 'Object' ? opts : {};
    var o = {_: {}};
    o.concurrency = (opts.concurrency && !opts.cookieSource)? opts.concurrency : 1;
    if(opts.cookieSource){o.cookieSource = opts.cookieSource;}
    if(opts.baseURL){o.baseURL = opts.baseURL;}
    o.delay = opts.delay || 10000;
    o.skipDuplicates = !!(opts.skipDuplicates);

    if (opts.open_timeout || opts.timeout) {o._.open_timeout = opts.open_timeout || opts.timeout;}
    if (opts.read_timeout) {o._.read_timeout = opts.read_timeout;}

    if (opts.proxy && typeof opts.proxy === 'string') {o._.proxy = opts.proxy;}
    if (opts.proxy && Object.prototype.toString.call(opts.proxy).slice(8,-1) === 'Array') {o.proxyArray = opts.proxy;}

    if (opts.headers) {o._.headers = opts.headers;}
    if (opts.cookieSource) {o._.cookies = {};}
    if (opts.cookies) {o._.cookies = opts.cookies;}
    if (opts.connection) {o._.connection = opts.connection;}
    if (opts.user_agent) {o._.user_agent = opts.user_agent;}
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

    var q = async.queue(function(url, cb){
        if (opts.proxyArray) {
            opts._.proxy = opts.proxyArray[Math.floor(Math.random()*opts.proxyArray.length)];
        }
        needle.get(url, opts._, function(err, res){
            if (!err && res.statusCode === 200) {
                if (opts.cookieSource && url === opts.cookieSource) {
                    for (var key in res.cookies){
                        if (!/^__utm/.test(res.cookies[key])){
                            opts._.cookies[key] = res.cookies[key];
                        }
                    }
                } else {
                    parse(url, cheerio.load(res.body), {
                        push: q.safePush,
                        save: function(v){result.push(v);},
                        step: log.step,
                        log: log
                    }, res);
                }
            } else {
                log.e(url);
                if (!q.paused) {
                    q.pause();
                    log.w('Paused!', new Date());
                    setTimeout(function(){
                        if (opts.cookieSource) {
                            q.unshift(opts.cookieSource);
                        }
                        q.resume();
                        log.i('Resumed!', new Date());
                    }, opts.delay);
                }
                q.push(url);
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

    q.safePush = function(url){
        function _push(url){
            if (!url || typeof url !== 'string') {
                return false;
            }
            if (opts.baseURL && !/^http/i.test(url)) {
                url = require('url').resolve(opts.baseURL, url);
            }
            if (passed[url] !== true) {
                passed[url] = true;
                q.push(url);
            }
            return true;
        }
        if (typeof url === 'string') {
            url = [url];
        }
        while(_push(url.shift())){}
    };

    if (opts.cookieSource) {
        q.safePush(opts.cookieSource);
    }
    q.safePush(startURL);
};