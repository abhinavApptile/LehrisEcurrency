const express = require("express");
const PORT = 3000; //4000 is the original one
const path = require("path");
const ejs = require("ejs");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Config = require("./models/config")
//auth
const session = require("express-session");
const bodyParser = require("body-parser");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//otp
const Otps = require("./models/otp")
const Blog = require("./models/blog")
const app = express();
//Purchase 
const https = require('https');
const Purchase = require("./models/purchase");
//paytm
const checksum_lib = require("./public/paytm/checksum");
const config = require("./public/paytm/config");
//middlewares
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.use(
    bodyParser.urlencoded({
        extended: false,
    })
);
app.use(
    session({
        secret: "keyboard cat",
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());
//for the mongodb
const mongoURI =
    "mongodb+srv://admin-Abhinav:admin-Abhinav@cluster0-fz1t0.mongodb.net/ecurrency";
mongoose
    .connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("database has been connected");
    });
mongoose.set("useCreateIndex", true);

//user schema
const userSchema = new mongoose.Schema({
    first_name: String,
    last_name: String,
    access: {
        type: Boolean,
        default: true
    },
    username: {
        type: String,
        
    },
    contact_number: {
        type: Number,
    },
    date: {
        type: Date,
        default: Date.now()
    },
    type:String

});
userSchema.plugin(passportLocalMongoose);
const User =  new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//  ====================== end authentication ====================//

//Get requests for the various pages
app.get("/commerceUsd", function(req, res){
    res.render("ecommerceUsd", {
        user: req.user,
        login:true
    })
});
app.get("/commerceInr", function(req, res){
    res.render("ecommerceInr", {
        user: req.user,
        login:true
    })
});
app.get("/", (req, res) => { 
    req.session.returnTo = req.originalUrl
    res.render("index", {
        user:req.user
    });
});
app.get("/contact", function (req, res) {
    req.session.returnTo = req.originalUrl
    res.render("contact", {
        user:req.user
    })  
});
app.get("/about", function (req, res) {
    req.session.returnTo = req.originalUrl
    res.render("about", {
        user:req.user
    })
});

app.get("/blog", async function (req, res) {
    try {
        req.session.returnTo = req.originalUrl    
        let blogs = await Blog.find();
        res.render("blog", { blogData: blogs, user: req.user });
        
    } catch (error) {
        res.json(error)
    }
    
});
app.get("/singleBlog/:id", async function (req, res) {
    try {
        req.session.returnTo = req.originalUrl   
        let blog = await Blog.findById(req.params.id); 
        res.render("singleBlog", {
            blog,
            user:req.user
         })
    } catch (error) {
        console.log(error);
    }
   
});
app.get("/neteller", function (req, res) {
    req.session.returnTo = req.originalUrl
    res.render("neteller", {
        user: req.user
    })
});
app.get("/skrill", function (req, res) {
    req.session.returnTo = req.originalUrl
    res.render("skrill", {
        user: req.user
    })
});
app.get("/entropay", function (req, res) {
    req.session.returnTo = req.originalUrl
    res.render("entropay", {
        user: req.user
    })
});
app.get("/login/:type", function (req, res) {
    let passedVariable = req.query.valid;
    if (req.params.type === "customer") {
        res.render("login", { user: req.user, passed: passedVariable });
    } else if(req.params.type === "admin") {
        res.render("admin/login",{ passed: passedVariable })
    }
});


app.get("/register/:type", function (req, res) {
     let passedVariable = req.query.valid;
    if (req.params.type === "customer") {
    res.render("register", { user: req.user,passed:passedVariable })
    } else {
         res.render("admin/register", {passed:passedVariable })
    }
  
});

app.get("/userDashboard", async function (req, res) {
    req.session.returnTo = req.originalUrl
    let auth = req.isAuthenticated();
    try {
        if (auth) {
        let passedVariable = req.query.message;
        let data = await Purchase.find({ user: req.user.id });
        res.render("userDashboard",{user:req.user, data, passedVariable})
    } else {
        res.redirect("/login/customer")
    }
    } catch (error) {
        console.log(error)
    }
})
//get request for auth

app.get("/logout", function (req, res) {
    req.logOut();
    res.render("index", {
        user: null
    })
});

//post for ecommerce

let cart = []; 
let purchaseDetail = {};
app.get("/address", async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth) {
        res.render("address", { user: req.user })
        
    } else {
        
        res.redirect("/login/customer")
    }
   
});
app.get("/finalCheck", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("finalCheck",{purchaseDetail,user:req.user})

    } else {
        req.session.returnTo = "/commerceInr"
        res.redirect("/login/customer")
    }
    
});
app.post("/finalCheckout", async function (req, res) {
    console.log(req.headers.origin);
    if (req.isAuthenticated()) {
        if (purchaseDetail.cart) {
            if (purchaseDetail.cart[0].currency === "INR") {
                  // ================= paytm integration for INR ======================= //
                  let total_amount = 0;
                    purchaseDetail.cart.forEach(function (data) {
                        total_amount += Number(data.amount)
                    });
                    
                    var paymentDetails = {
                        amount: total_amount,
                        customerId: req.user.first_name,
                        customerEmail: req.user.username,
                        customerPhone: req.user.contact_number
                    }
                    if (!paymentDetails.amount || !paymentDetails.customerId || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
                        res.status(400).send('Payment failed')
                    } else {
                        var params = {};
                        params['MID'] = config.PaytmConfig.mid;
                        params['WEBSITE'] = config.PaytmConfig.website;
                        params['CHANNEL_ID'] = 'WEB';
                        params['INDUSTRY_TYPE_ID'] = 'Retail';
                        params['ORDER_ID'] = 'TEST_' + new Date().getTime();
                        params['CUST_ID'] = paymentDetails.customerId;
                        params['TXN_AMOUNT'] = paymentDetails.amount;
                        params['CALLBACK_URL'] = `${req.headers.origin}/callback`;
                        params['EMAIL'] = paymentDetails.customerEmail;
                        params['MOBILE_NO'] = paymentDetails.customerPhone;


                        checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
                            var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
                            // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production

                            var form_fields = "";
                            for (var x in params) {
                                form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
                            }
                            form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
                            res.end();
                        });
                    }
            } else if (purchaseDetail.cart[0].currency === "USD") {
                  // ================= paytm integration for USD ======================= //
                Config.find({}, function(err, dataArray) {
                    
                    let data = dataArray[dataArray.length - 1];
                    
                    let rates = data.exchange;
                         let total_amount = 0;
                        purchaseDetail.cart.forEach(function (data) {
                            total_amount += Number(data.amount)*rates
                        
                        })
                    var paymentDetails = {
                        amount: Math.round((total_amount + Number.EPSILON) * 100) / 100,
                        customerId: req.user.first_name,
                        customerEmail: req.user.username,
                        customerPhone: req.user.contact_number
                    }
                    if (!paymentDetails.amount || !paymentDetails.customerId || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
                        res.status(400).send('Payment failed')
                    } else {
                        var params = {};
                        params['MID'] = config.PaytmConfig.mid;
                        params['WEBSITE'] = config.PaytmConfig.website;
                        params['CHANNEL_ID'] = 'WEB';
                        params['INDUSTRY_TYPE_ID'] = 'Retail';
                        params['ORDER_ID'] = 'TEST_' + new Date().getTime();
                        params['CUST_ID'] = paymentDetails.customerId;
                        params['TXN_AMOUNT'] = paymentDetails.amount;
                        params['CALLBACK_URL'] = `${req.headers.origin}/callback`;
                        params['EMAIL'] = paymentDetails.customerEmail;
                        params['MOBILE_NO'] = paymentDetails.customerPhone;


                        checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
                            var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
                            // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production

                            var form_fields = "";
                            for (var x in params) {
                                form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
                            }
                            form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
                            res.end();
                        });
                    }
                               
                    });
                 }; 
        }
    } else {
        req.session.returnTo = "/commerceInr"
        res.redirect("/login/customer")
    }
});

app.post("/callback", async (req, res) => {

    if (req.body.RESPCODE === "01") {
        const newPurchase = new Purchase(purchaseDetail);
        await newPurchase.save();
        cart = [];
        var string = encodeURIComponent('Purchase Successful!');
        res.redirect("/userDashboard?message="+string)
    } else {
        var string = encodeURIComponent('Payment Uncessfull!');
        res.redirect("/userDashboard?message="+string)
    }
   
});

app.post("/checkout",async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth) {
        
        const { full_name, mobile_number, pin_code, flat_number, area, landmark, town, state } = req.body;
        const purchaseData = {
            user: req.user.id,
            cart: cart,
            address: {
                full_name,
                mobile_number,
                pin_code,
                flat_number,
                area,
                landmark,
                town,
                state
            }
        }
        
        purchaseDetail = purchaseData
        res.redirect("/finalCheck")
        
    } else {
    req.session.returnTo = "/commerceInr"
        res.redirect("/login/customer")
    }
       
})


app.post("/ecommerce", async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth) {
        cart =JSON.parse(req.body.cartData);
    } else {
        req.session.returnTo = "/address"
        res.redirect("/login/customer")
    }
   
})

//post requests for authentication
app.post("/register/:type", async function (req, res) {
    const {first_name,last_name, username, password, contact_number,repassword } = req.body;

    if (password === repassword) {
        User.register({ username: username }, password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register/customer");
        } else {
            passport.authenticate("local")(req, res, async function () {
                if (req.params.type === "admin") {
                    user.type = "admin"
                } else {
                     user.type = "customer"
                }
                user.contact_number = contact_number,
                user.first_name = first_name,
                user.last_name = last_name
                await user.save();
                if(req.params.type === "admin") res.redirect("/admin")
                res.redirect(req.session.returnTo || '/');
                delete req.session.returnTo;

            });
        }
    });
    } else {
          var string = encodeURIComponent('Passwords do not match!');
        if (req.params.type === "customer") {
          
          res.redirect('/register/customer?valid=' + string);
        } else {
             res.redirect('/register/admin?valid=' + string);
        }
        

    }

    
});

//login user
app.post("/login/:type", async function (req, res) {
   
    
        let user = await User.findOne({ username: req.body.username });
        if (user) {
            if (user.type === req.params.type) {
                if (user.access) {
                    const user = new User({
                    username: req.body.username,
                    password: req.body.password,
                    });

                    req.login(user, function (err) {
                        if (err) {
                            console.log(err);
                            
                        } else {
                           
                            passport.authenticate("local", function (err, user, info) {
                               
                                if (user) {
                                   if(req.params.type === "admin") res.redirect("/admin")
                                    res.redirect(req.session.returnTo || '/');
                                    delete req.session.returnTo; 
                                } else {
                                    let string = encodeURIComponent('UserName Or Passport is incorrect !');
                                    req.logOut();
                                    if (req.params.type === "admin") {
                                        res.redirect("/login/admin?valid=" + string);
                                    } else {
                                        res.redirect("/login/customer?valid=" + string);
                                    }
                                    
                                }
                               
                            })(req, res, function () {});
                        }
                    }); 
                } else {
                    let string = encodeURIComponent('Authetication error!');
                    res.redirect("/login/customer?valid=" + string);
                }
              
            }
        } else {
            var string = encodeURIComponent('Authentication error!!');
            res.redirect('/login/customer?valid=' + string);
        }
        
   

   
})
//==========================For reseting password ========================//

let userStorage = {};
app.get("/getEmail", function (req, res) {
    let passedVariable = req.query.message;
    res.render("passwordReset/email", { message: passedVariable, user: null });

});
//function to generate random otps.
var generateOtp = (n) => {
  return Math.floor(Math.random() * (9 * (Math.pow(10, n)))) + (Math.pow(10, n));
}
app.get("/getOTP", async function (req, res) {
    res.render("passwordReset/otp", { message: null, user: null });
    let generatedOtp = generateOtp(5);
    console.log(generatedOtp);
     let newOtp = new Otps({
        user: userStorage.id,
        otp: generatedOtp
    });
    await newOtp.save()
    //==================Nodemailer integration===============//
    let mailBody = ` <div style="text-align:center">
        <h1>Lehris Ecurrency</h1>
        <h3>The otp for the password change is ${generatedOtp}</h3>
        <p>Do not shre this otp with anyone</p>
        </div>
    `
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
        user: "btoscenquiries@gmail.com", 
        pass: "Btosc@123", 
        },
        tls: {
            rejectUnauthorized:false
        }
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: '"Abhinav sharma" <abhiut37@gmail.com>', // sender address
        to: userStorage.username, // list of receivers
        subject: " OTP for the change of password ", // Subject line
        text: "Hello world?", // plain text body
        html:mailBody, // html body
    });

    // console.log("Message sent: %s", info.messageId);
    // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    //==================Nodemailer integration finished===============//
    
   

});
app.get("/passwordReset", function (req, res) {
    let passedVariable = req.query.message;
    res.render("passwordReset/passwordReset", { user: null, message: passedVariable });
})
app.post("/getEmail", async function (req, res) {
    const { email } = req.body;
    let user = await User.findOne({ username: email });
    if (user) {
        userStorage = user;
        res.redirect("/getOtp");
    } else {
        var string = encodeURIComponent('User not found!');
        res.redirect("/getEmail?message=" + string);
    }
    
});
app.post("/getOTP", async function (req, res) {
    const { otp } = req.body;
    let otps = await Otps.find({ user: userStorage.id });
    let requiredOtp = otps[otps.length - 1];
    let timeElapsedInMills = Date.now() - requiredOtp.date;
    let timeElapsedInMinutes = Math.floor(timeElapsedInMills / 60000)
    if (otp == requiredOtp.otp) {
        if (timeElapsedInMinutes < 5) {
            res.redirect("/passwordReset");
        } else {
            res.render("passwordReset/otp",{message:"Time out! try again later.", user:null});
        }
        
    } else {
        res.render("passwordReset/otp",{message:"Wrong OTP! Retype.", user:null});
    }
    
});
app.post("/passwordReset", async function (req, res) {
    const { password, repassword } = req.body;
    const { access, contact_number, username, first_name, last_name, type, date, _id } = userStorage;
    await User.deleteOne({ username: username });
    if (password === repassword) {
        User.register({ username: username }, password, async function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register/customer");
        } else {
                user.access = access
                user.type = type
                user.date = date
                user.contact_number = contact_number,
                user.first_name = first_name,
                user.last_name = last_name
                await user.save();
                let purchase = await Purchase.find({ user: userStorage.id });
                purchase.forEach(async function (e) {
                    e.user = user.id
                    await e.save()
                });
                let string = encodeURIComponent('Password change successfull!! Please login with the new password!');
                res.redirect('/login/customer?valid='+string);
  
            }
    });
    } else {
          var string = encodeURIComponent('Passwords do not match!');
          res.redirect('/passwordReset?message=' + string);
    }

});


//=======================for admin panel=============================//

app.get("/admin", async function (req, res) {
    
    let auth = req.isAuthenticated();
    if (auth) {
        if (req.user.type === "admin") {
            let passedVariable = req.query.valid;
            let all_customers = await User.find({ type: "customer" });
            let orders = await Purchase.find({});
            let allConfigs = await Config.find({});
            let configs = allConfigs[allConfigs.length - 1];  
            orders.reverse()
            res.render("admin/index", { user: req.user, all_customers,orders,message:passedVariable, configs })
        } else {
            res.redirect("/")
        }
    } else {
        res.redirect("/login/admin")
    }
    
});
app.get("/logout/admin", function (req, res) {
    req.logOut();
    res.redirect("/login/admin")
});
app.get("/singleUser/:id", async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth && req.user.type === "admin") {
        let purchases = await Purchase.find({ user: req.params.id });
        let customer = await User.findById(req.params.id);
          let allConfigs = await Config.find({});
            let configs = allConfigs[allConfigs.length - 1];  
        res.render("admin/singleUser", { user: req.user, purchases, customer, configs });
    } else {
        res.redirect("/login/admin")
    }
    
});
app.get("/blockUser/:id", async function (req, res) {
    if (req.isAuthenticated && req.user.type === "admin") {
        let user = await User.findById(req.params.id);
        user.access = !user.access;
        await user.save();
        var string = encodeURIComponent(`${user.first_name}'s Status Change Successful!`);
        res.redirect("/admin?valid=" + string);
    } else {
        
        res.redirect("/login/admin")
    }
});

app.get("/singleOrder/:id", async function (req, res) {
    let Orderid = req.params.id;

    if (req.isAuthenticated() && req.user.type === "admin") {
        let order = await Purchase.findById(Orderid);
          let allConfigs = await Config.find({});
            let configs = allConfigs[allConfigs.length - 1];  
        res.render("admin/singleOrder", { order, user: req.user, configs })
    } else {
        res.redirect("/login/admin")
    }
});
app.get("/admin/orders", async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth) {
        if (req.user.type === "admin") {
            let passedVariable = req.query.valid;
              let allConfigs = await Config.find({});
            let configs = allConfigs[allConfigs.length - 1];  
            let orders = await Purchase.find({});
            orders.reverse()
            res.render("admin/orders", { user: req.user, orders, message: passedVariable, configs })
        } else {
            res.redirect("/")
        }
    } else {
        res.redirect("/login/admin")
    }
});

app.get("/admin/users", async function (req, res) {
    
    let auth = req.isAuthenticated();
    if (auth) {
        if (req.user.type === "admin") {
            let passedVariable = req.query.valid;
            let all_customers = await User.find({ type: "customer" });
              let allConfigs = await Config.find({});
            let configs = allConfigs[allConfigs.length - 1];  
            res.render("admin/users", { user: req.user, all_customers,message:passedVariable, configs })
        } else {
            res.redirect("/")
        }
    } else {
        res.redirect("/login/admin")
    }
    
});

app.post("/admin/currencyControl", async function (req, res) {
    let auth = req.isAuthenticated();
    if (auth) {
        if (req.user.type === "admin") {
            let exchangeAmount = req.body.setExchange;
            let newConfig = new Config({
                user: req.user.id,
                exchange: exchangeAmount
            });
            await newConfig.save();
            let string = encodeURIComponent("Exchange rate changed successfully");
            res.redirect("/admin?valid=" + string);
        } else {
            res.redirect("/")
        }
    } else {
        res.redirect("/login/admin")
    }
})
//================= Last 4 pages ==========================//
app.get("/cards/:name", function (req, res) {
    req.session.returnTo = req.originalUrl
    let name = req.params.name;
    if (name === "ecopayz") {
            res.render("ecopayz", {
            user: req.user
        })
    } else if (name === "muchBetter") {
        res.render("muchBetter", {
            user: req.user
        })
    } else if (name === "bitcoins") {
        res.render("bitcoins", {
            user: req.user
        })
    }
   
});

//===================== for the 404 page =======================//

app.get("*", function (req, res) {
    res.render("404",{user:req.user});
})


//for the listening port
app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
});
