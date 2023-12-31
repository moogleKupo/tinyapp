const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");
const getUserByEmail = require('./helpers');
const app = express();
const PORT = 8080;

// Helper function to generate random string for shortURL
function generateRandomString() {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 6;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
  const userId = req.session.user_id;
  if (!userId || !users[userId]) {
    res.redirect("/login");
  } else {
    next();
  }
}

// Helper function to get URLs for a specific user
function urlsForUser(id) {
  const userURLs = {};
  for (const shortURL in urlDatabase) {
    const urlObj = urlDatabase[shortURL];
    if (urlObj.userID === id) {
      userURLs[shortURL] = urlObj;
    }
  }
  return userURLs;
}

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieSession({
    name: "session",
    keys: ["secretKey"],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

const users = {
  userRandomID: {
    id: "userRandomID",
    email: "user@example.com",
    password: "$2b$10$zKc/W5PLZUxXaOoKIIK8KO6cPbiG01Wn7FGT4Z0J0lcIWX6DyAotO"
  }
};

const urlDatabase = {
  b2xVn2: {
    longURL: "http://www.lighthouselabs.ca",
    userID: "userRandomID"
  },
  "9sm5xK": {
    longURL: "http://www.google.com",
    userID: "user2RandomID"
  }
};

// Root route
app.get("/", (req, res) => {
  res.send("Hello!");
});

// URLs Index page - Show only the logged-in user's URLs
app.get("/urls", requireLogin, (req, res) => {
  const userId = req.session.user_id;
  const user = users[userId];
  const userUrls = urlsForUser(userId);

  const templateVars = {
    user: user,
    urls: userUrls,
  };
  res.render("urls_index", templateVars);
});

// New URL page
app.get("/urls/new", requireLogin, (req, res) => {
  const userId = req.session.user_id;
  const user = users[userId];
  res.render("urls_new", { user: user });
});

// Create new URL
app.post("/urls", requireLogin, (req, res) => {
  const longURL = req.body.longURL;
  const shortURL = generateRandomString();
  const userId = req.session.user_id;
  urlDatabase[shortURL] = { longURL: longURL, userID: userId };
  res.redirect(`/urls/${shortURL}`);
});

// Show URL details
app.get("/urls/:id", (req, res) => {
  const userId = req.session.user_id;
  const user = users[userId];
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];

  if (!url || url.userID !== userId) {
    const templateVars = {
      errorMessage: "You don't have permission to access this URL"
    };
    res.status(403).render("urls_error", templateVars);
    return;
  }

  const templateVars = {
    user: user,
    id: shortURL,
    longURL: url.longURL
  };
  res.render("urls_show", templateVars);
});

// Edit URL
app.post("/urls/:id", (req, res) => {
  const userId = req.session.user_id;
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];

  if (!url || url.userID !== userId) {
    const templateVars = {
      errorMessage: "You don't have permission to edit this URL"
    };
    res.status(403).render("urls_error", templateVars);
    return;
  }

  const updatedURL = req.body.longURL;
  urlDatabase[shortURL].longURL = updatedURL;
  res.redirect("/urls");
});

// Delete URL
app.post("/urls/:id/delete", (req, res) => {
  const userId = req.session.user_id;
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];

  if (!url || url.userID !== userId) {
    const templateVars = {
      errorMessage: "You don't have permission to delete this URL"
    };
    res.status(403).render("urls_error", templateVars);
    return;
  }

  delete urlDatabase[shortURL];
  res.redirect("/urls");
});

// Register page
app.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).send("Email and password cannot be empty.");
    return;
  }

  const existingUser = getUserByEmail(email, users);
  if (existingUser) {
    res.status(400).send("Email already registered.");
    return;
  }

  const userId = generateRandomString();

  const newUser = {
    id: userId,
    email,
    password: bcrypt.hashSync(password, 10)
  };

  users[userId] = newUser;

  res.cookie("user_id", userId);
  res.redirect("/urls");
});


app.get("/register", (req, res) => {
  const userId = req.session.user_id;
  const user = users[userId];
  res.render("register", { user: user });
});

// Login page
app.get("/login", (req, res) => {
  const userId = req.session.user_id;
  const user = users[userId];
  res.render("login", { user: user });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = getUserByEmail(email, users);

  if (!user) {
    // If user not found, show an error message on the login page
    res.status(403).render("login", { errorMessage: "User not found.", user: null });
    return;
  }

  if (!bcrypt.compareSync(password, user.password)) {
    // If the password is incorrect, show an error message on the login page
    res.status(403).render("login", { errorMessage: "Invalid password.", user: null });
    return;
  }

  // If the credentials are correct, set the user_id in the session and redirect to /urls
  req.session.user_id = user.id;
  res.redirect("/urls");
});


// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("user_id");
  res.redirect("/urls");
});

app.post("/logout", (req, res) => {
  // Clear the user_id session cookie to log the user out
  req.session.user_id = null;
  res.redirect("/login");
});

app.post("/logout", (req, res) => {
  // Clear the user_id session cookie to log the user out
  req.session.user_id = null;
  res.redirect("/login");
});

// Error page
app.get("/urls/error", (req, res) => {
  res.render("urls_error");
});

// Redirect shortURL to longURL
app.get("/u/:id", (req, res) => {
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];
  if (url) {
    res.redirect(url.longURL);
  } else {
    res.status(404).send("Short URL not found.");
  }
});

app.listen(PORT, () => {
  console.log(`TinyApp listening on port ${PORT}!`);
});
