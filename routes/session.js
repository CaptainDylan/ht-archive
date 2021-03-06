/* 
 * Copyright (C) <year> <copyright holder>
 * All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the BSD license.  See the LICENSE file for details.
 */


var daos = require("./daos")

function SeshHandler(client) {
    "use strict";

    var usrdao  = new daos.UsrDAO(client)
    var seshdao = new daos.SeshDAO(client)

    this.isLoggedInMiddleware = function(req, res, next) {
        var sesh_id = req.cookies.sesh;
        seshdao.getUsr(sesh_id, function(err, usr) {
            "use strict";
            if(!err && usr) {
                req.usr = usr["username"];
                req.usrid = usr["userid"];
                return next();
            }
            return res.render("/login");
        });
    }

    this.displayLogin = function(req, res, next) {
        "use strict";
        return res.render("login", {usr: "", pass: "", login_err: ""});
    }

    this.handleLogin = function(req, res, next) {
        "use strict";

        var usr  = req.body.usr;
        var pass = req.body.pass;

        usrdao.validLogin(usr, pass, function(err, doc) {
            "use strict";

            if(err) {
                if(err.bad_usr) {
                    return res.render("login",
                            {usr: doc, pass: "", login_err: "No Such User"});
                } else if(err.bad_pass) {
                    return res.render("login",
                            {usr: doc, pass: "", login_err: "Invalid Password"});
                } else {
                    return next(err);
                }
            }

            usrdao.getUserByName(usr, function(err, userdata) {
                if(err) return next(err);

                seshdao.startSesh(userdata, function(err, sesh_id) {
                    "use strict";

                    if(err) return next(err);

                    res.cookie("sesh", sesh_id);
                    return res.redirect("/welcome");
                });
            });
        });
    }

    this.displayLogout = function(req, res, next) {
        "use strict";

        var sesh_id = req.cookies.sesh;
        seshdao.endSesh(sesh_id, function(err) {
            "use strict";
            res.cookie("sesh", "");
            return res.redirect("/");
        });
    }

    this.displayWelcome = function(req, res, next) {
        "use strict";

        if(!req.usr) {
            return res.redirect("/login");
        }

        var sesh_id = req.cookies.sesh;

        res.render("welcome", {"usr": req.usr});
    }

    function validSignup(usr, pass, verify, email, errs) {
        "use strict";

        var usr_re = /^[a-zA-z0-9_-]{3,20}$/;
        var pass_re = /^.{3,20}$/;
        var email_re = /^[\S]+@[\S]+\.[\S]+/;

        if(!usr_re.test(usr)) {
            errs["usr_err"] = "invalid username";
            return false;
        }
        if(!pass_re.test(pass)) {
            errs["pass_err"] = "invalid password";
            return false;
        }
        if(pass != verify) {
            errs["verify_err"] = "passwords do not match";
            return false;
        }
        if(!email_re.test(email)) {
            errs["emails"] = "invalid email";
            return false;
        }
        return true;
    }

    this.displaySignup = function(req, res, next) {
        "use strict";
        res.render("signup", {"usr": "", "pass": "", "email": "",
            "pass_err": "", "usr_err": "", "email_err": "",
            "verify_err": ""});
    }

    this.handleSignup = function(req, res, next) {
        "use strict";

        var usr    = req.body.usr;
        var pass   = req.body.pass;
        var verify = req.body.verify;
        var email  = req.body.email;

        var errs = {"usr": usr, "pass": pass, "usr_err": "",
            "pass_err": "", "verify_err": "", "email_err": ""};
        if(validSignup(usr, pass, verify, email, errs)) {
            usrdao.addUsr(usr, pass, email, function(err, doc) {
                "use strict";

                if(err) {
                    console.log(err.name);
                    var keys = Object.keys(err);
                    for(var i = 0; i < keys.length; ++i) {
                        console.log(err[keys[i]]);
                    }
                    if(err["code"] == "23505") {
                        if(errs["constraint"] == "siteusers_name_key") {
                            errs["usr_err"] = "invalid username. user already in use";
                            return res.render("signup", errs);
                        } else if(errs["constraint"] == "siteusers_email_key") {
                            errs["email_err"] = "invalid email. email already in use";
                            return res.render("signup", errs);
                        }
                    }
                    return next(err);
                }

                res.redirect("/login");
            });
        } else {
            return res.render("signup", errs);
        }
    }

}

module.exports = SeshHandler;
