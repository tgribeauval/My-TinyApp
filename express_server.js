const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080; // default port 8080
const bodyParser = require ("body-parser");
const bcryptjs = require('bcryptjs');
const cookieSession = require('cookie-session')

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}))
app.use(express.static('public'));
app.set("view engine", "ejs");

// Chooses a random alphanumeric character between '0' (ascii 48)
// and 'z' (ascii 122) while omitted special character in between.
// Not the most efficient code but I wanted to try this method.
function generateRandomString() {
  let uniqueID = "";
  const minASCII = 48;
  const maxASCII = 122
  let randIndex;
  const forbidChars = [58, 59, 60, 61, 62, 63, 64, 91, 92, 93, 94, 95, 96];
  while (uniqueID.length < 6) {
    randIndex = Math.floor(Math.random() * (maxASCII - minASCII + 1)) + minASCII;
    if (!forbidChars.includes(randIndex)) {
      uniqueID += String.fromCharCode(randIndex);
    }
  }
  return uniqueID;
};

// match user-submitted log-in email to an email in the users database.
// returns the user's information as an object.
function matchUser(email) {
  let returned;
  for (let rand in users) {
    if(email === users[rand].email) {
      returned = users[rand];
      break;
    } else {
      returned = 403;
    };
  };
  return returned;
}

let users = {};
let pageVisits = 0;

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

// home page
app.get("/", (req, res) => {
  pageVisits += 1
  let login = { username: req.session.username,
                info: users[req.session.user_id],
                pageVisits: pageVisits};
  res.render("urls_home", login);
});

// register page
app.get("/register", (req, res) => {
  let login = { username: req.session.username,
                info: users[req.session.user_id] }
  res.render("urls_register", login);
});

// registers a user and redirects to homepage if successful
app.post("/register", (req, res) => {
  for (let rand in users) {
    if (req.body.email === users[rand].email) {
      res.status(400).send("Sorry, the email you entered is already in use. Try to <a href='/register'>register</a> again.");
    };
  };
  if (req.body.email === '' || req.body.password === '') {
    res.status(400).send("Sorry, there was not enough information to process your registration. \nPlease try to <a href='/register'>register</a> again with both an email address and a password.");
  } else {
    let userID = generateRandomString();
    let hashedPassword = bcryptjs.hashSync(req.body.password, 10);
    users[userID] = { id: userID,
                      email: req.body.email,
                      password: hashedPassword,
                      database: {} };
    req.session.user_id = userID;
    res.redirect("/");
  };
});

// log-in page
app.get("/login", (req, res) => {
  let login = { username: req.session.username,
                info: users[req.session.user_id] };
  res.render("urls_login", login);
})

// logs in the user if email is found in user database and inputted password matches that user's database password
app.post("/login", (req, res) => {
  if (req.body.email === "") {
    res.send("Please enter an email to log in. Try to <a href='/login'>log in</a> again.");
  } else {
    let matchedUser = matchUser(req.body.email);
    if ((matchedUser === 403) || matchedUser === undefined) {
      res.status(403).send("This email does not exist. Try to <a href='/login'>log in</a> again.");
    } else {
      if (bcryptjs.compareSync(req.body.password, matchedUser.password)) {
        req.session.user_id = matchedUser.id;
        res.redirect("/");
      } else {
        res.status(403);
        res.send("Sorry, this password does not the given email. Try to <a href='/login'>log in</a> again.");
      };
    }
  }
});

// logging out redirects to home page
app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/");
})

// URL shorten page
app.get("/urls/new", (req, res) => {
  let login = { username: req.session.username,
                info: users[req.session.user_id] };
  res.render("urls_new", login);
});

// shorten a URL if user is logged in
app.post("/urls", (req, res) => {
  if (req.session.user_id) {
    let generatedCode = generateRandomString();
    if (req.body.longURL.slice(0, 7) === "http://" || req.body.longURL.slice(0, 8) === "https://") {
      urlDatabase[generatedCode] = req.body.longURL;
      users[req.session.user_id].database[generatedCode] = req.body.longURL;
      res.redirect('/urls/' + generatedCode);
    } else {
      urlDatabase[generatedCode] = "http://" + req.body.longURL;
      users[req.session.user_id].database[generatedCode] = "http://" + req.body.longURL;
      res.redirect('/urls/' + generatedCode);
    };
  } else {
    res.status(401).send("You need to be logged in to shorten a URL. Please log in <a href='http://localhost:8080/login'>here</a>.");
  };
});

// page displays all user-created shortened URLS
// page does not display to non-logged-in users
app.get("/urls" , (req, res) => {
  if (req.session.user_id) {
    let locals = { urls: users[req.session.user_id].database,
                   username: req.session.username,
                   info: users[req.session.user_id] };
    res.render("urls_index", locals);
  } else {
    res.status(401);
    res.send("You need to be logged in to view this page. <a href='/login'>Log in</a> here.");
  }
});

// page that shows an individual shortened URL
app.get("/urls/:id" , (req, res) => {
  if (req.session.user_id) {
    if (req.params.id in users[req.session.user_id].database) {
      let locals = { shortURL: req.params.id,
                   longURL: urlDatabase,
                   username: req.session.username,
                   info: users[req.session.user_id] };
      res.render("urls_show", locals);
    } else {
      res.status(404).send("This page was not found. Try <a href='/urls/new'>shortening a URL</a> to generate a working link.");
    }
  } else {
    res.status(401).send("You need to be logged in to view this page. <a href='/login'>Log in</a> here.");
  }
});

// redirects the short URL to the Long URL
app.get("/u/:shortURL", (req, res) => {
  let randCode = req.params.shortURL;
  let longURL = urlDatabase[randCode];
  if (longURL === undefined) {
    res.status(404).send("No matching page was found. Try <a href='/urls/new'>shortening a URL</a> to generate a working link.");
  } else {
    res.redirect(longURL);
  }
});

// deletes the object key-value pair corr. to id and redircts to /urls page
app.post("/urls/:id/delete", (req, res) => {
  delete users[req.session.user_id].database[req.params.id]
  res.redirect("/urls");
})

// updates an existing entry's long URL
app.post("/:id/update", (req, res) => {
  if (req.body.updatedLongURL.slice(0, 7) === "http://" || req.body.updatedLongURL.slice(0, 8) === "https://") {
    urlDatabase[req.params.id] = req.body.updatedLongURL;
    users[req.session.user_id].database[req.params.id] = req.body.updatedLongURL;
  } else {
    urlDatabase[req.params.id] = "http://" + req.body.updatedLongURL;
    users[req.session.user_id].database[req.params.id] = "http://" + req.body.updatedLongURL;
  };
  res.redirect("/urls")
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});
