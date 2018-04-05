var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

//Scraping tools
var request = require("request");
var cheerio = require("cheerio");

// Require all models
// var db = require("./models");
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

//Defining PORT
mongoose.Promise = Promise;
var port = process.env.PORT  || 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false}));
// Use express.static to serve the public folder as a static directory
//app.use(express.static("public"));
app.use(express.static(__dirname + '/public'));
// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI  || "mongodb://localhost/mongoHeadlines";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);



// Routes
//GET requests to render Handlebars pages
app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});
app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});





// A GET route for scraping the chicago tribune website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://www.nytimes.com/", function(error,response,html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);

    // Now, we grab every h2 within an article tag, and do the following:
    $("article").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("h2")
        .text();
        result.summary = $(this)
        .children(".summary")
        .text();
      result.link = $(this)
        .children("h2")
        .children("a")
        .attr("href");

      // Create a new Article using the `result` object built from scraping
      var entry = new Article(result);

       entry.save(function(err,doc){
         if(err){
           console.log(err);
         }
         else{
           console.log(doc);
         }
       });
      });
    // If we were able to successfully scrape and save an Article, send a message to the client
    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
Article.find({}, function(error, doc){
  if(error){
    console.log(error);
  }
  else{
    res.json(doc);
  }
});
});
    

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .exec(function(error,doc) {
     if(error){
       console.log(error);
     }
     else{
       res.json(doc);
     }
    });
  });
     
    

// Route for saving/updating an Article
app.post("/articles/save/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  // Execute the above query
  .exec(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      // Or send the document to the browser
      res.send(doc);
    }
  });
});

// Delete an article
app.post("/articles/delete/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  // Execute the above query
  .exec(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      // Or send the document to the browser
      res.send(doc);
    }
  });
});


// Create a new note
app.post("/notes/save/:id", function(req, res) {
// Create a new note and pass the req.body to the entry
var newNote = new Note({
body: req.body.text,
article: req.params.id
});
console.log(req.body)
// And save the new note the db
newNote.save(function(error, note) {
// Log any errors
if (error) {
  console.log(error);
}
// Otherwise
else {
  // Use the article id to find and update it's notes
  Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
  // Execute the above query
  .exec(function(err) {
    // Log any errors
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      // Or send the note to the browser
      res.send(note);
    }
  });
}
});
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
// Use the note id to find and delete it
Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
// Log any errors
if (err) {
  console.log(err);
  res.send(err);
}
else {
  Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
   // Execute the above query
    .exec(function(err) {
      // Log any errors
      if (err) {
        console.log(err);
        res.send(err);
      }
      else {
        // Or send the note to the browser
        res.send("Note Deleted");
      }
    });
}
});
});
 




// Start the server
app.listen(port, function() {
  console.log("App running on port " + port + "!");
});
