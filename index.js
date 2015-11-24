var cheerio = require('cheerio');
var needle = require('needle');
var async = require('async');
var caba = require('caba')();

function filterOpts(opts){
    opts = Object.prototype.toString.call(opts).slice(8,-1) === 'Object' ? opts : {};
    var o = {_: {}};
    if(opts.cookieSource){o.cookieSource = opts.cookieSource;}
    o.delay = opts.delay || 10000;

    if (opts.open_timeout || opts.timeout) {o._.open_timeout = opts.open_timeout || opts.timeout;}
    if (opts.read_timeout) {o._.read_timeout = opts.read_timeout;}
    if (opts.proxy) {o._.proxy = opts.proxy;}
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
    opts = filterOpts(opts);
    caba.start('%s results found');

    var q = async.queue(function(url, cb){
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
                        push: q.push,
                        save: function(v){result.push(v);},
                        step: caba.step,
                        log: caba.log
                    }, res);
                }
            } else {
                caba.log('Error:', url);
                if (!q.paused) {
                    q.pause();
                    caba.log('Paused!', new Date());
                    setTimeout(function(){
                        if (opts.cookieSource) {
                            q.unshift(opts.cookieSource);
                        }
                        q.resume();
                        caba.log('Resumed!', new Date());
                    }, opts.delay);
                }
                q.push(url);
            }
            cb();
        });
    });

    q.drain = function(){
        caba.finish();
        done(result);
    };

    if (opts.cookieSource) {
        q.push(opts.cookieSource);
    }
    q.push(startURL);
};