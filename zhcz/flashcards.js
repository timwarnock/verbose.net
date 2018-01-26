/*
*/

//GLOBALS

// max time (in seconds) for each card
MAX_WAIT = 10;

// this will be set by async json call
var FC_DATA = [
  {"key": "??", "answer": "42", "alt": "43?" },
  {"key": "Pi",   "answer": "3.141592653", "alt": "3" }
];

// audio cache
var FC_AUDIO = [false, false];
var FC_AUDIO_PROMPT = [false, false];

// the pointer into FC_DATA and FC_SCORE
var CURR_FC = 0;

// max cards before magic shuffle
var HOW_MANY = 8; 

// the next indeces for CURR_FC
var NEXT_UP = [];

// save state for which side of the card is showing
var FC_STATUS = 'front';

// remember if the user flipped the current card
var FIRST_FLIP = true;




// shortcut to getElementById
function $(el) {
  return document.getElementById(el);
}




// stopwatch function (use system time)
var START_TS = new Date().getTime();
var startwatch = function() {
  START_TS = new Date().getTime();
};
var stopwatch = function() {
  return (new Date().getTime() - START_TS)/1000;
};



// fetch JSON object from URL
var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        var resjson = xhr.response;
        if (typeof resjson == "string") {
          resjson = JSON.parse(xhr.response);
        }
        callback(null, resjson);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};

// scores will be initialized from localStorage
var FC_SCORE = [0,0];
var FC_NAME;
Storage.prototype.setObj = function(key, obj) {
  return this.setItem(key, JSON.stringify(obj))
}
Storage.prototype.getObj = function(key) {
  return JSON.parse(this.getItem(key))
}
function initScores(fcname) {
  FC_NAME = fcname;
  FC_SCORE = localStorage.getObj(fcname);
  if (!FC_SCORE) {
    clearScores();
  }
}
function clearScores() {
  NEXT_UP = [];
  FC_SCORE = Array.apply(null, Array(FC_DATA.length)).map(Number.prototype.valueOf,MAX_WAIT);
}
function getScore(index) {
  return FC_SCORE[index];
}
function setScore(index,score) {
  FC_SCORE[index] = score;
  localStorage.setObj(FC_NAME,FC_SCORE);
}


// return the current flashcard data
function _currFlashcard() {
  return FC_DATA[CURR_FC];
};

// fetch the next flashcard, and set the internal pointer
function _nextFlashcard() {
  var cand = NEXT_UP.shift();
  if (cand == null) {
    var score_index = reverse_scores_index();
    var how_many = HOW_MANY < score_index.length ? HOW_MANY : score_index.length;
    NEXT_UP = score_index.slice(0,how_many);
    cand = NEXT_UP.shift();
console.log(FC_SCORE);
  }
  //CURR_FC = (CURR_FC + 1) % FC_DATA.length;
  CURR_FC = cand;
  return _currFlashcard();
};

// internal, return reverse-sorted array of indexes (from flashcard scores)
function reverse_scores_index() {
  var toSort = FC_SCORE.slice();
  for (var i = 0; i < toSort.length; i++) {
    toSort[i] = [toSort[i], i];
  }
  toSort.sort(function(left, right) {
    return left[0] > right[0] ? -1 : 1;
  });
  toSort.sortIndices = [];
  for (var j = 0; j < toSort.length; j++) {
    toSort.sortIndices.push(toSort[j][1]);
    toSort[j] = toSort[j][0];
  }
  return toSort.sortIndices;
};

// internal, set the DOM based on the current selected flashcard
function _setFlashcard() {
  var fc = _currFlashcard();
  fcstat( CURR_FC+1 + ' of ' + FC_DATA.length + ' cards');
  var fcf = '<div class="flashcard-prompt">'
  fcf += fc.key + '</div>';
  $('flashcard-front').innerHTML = fcf;
  var fcb = '<div class="flashcard-full-answer">' + fc.answer + '</div>';
  fcb += '<div class="flashcard-full-key">' + fc.key + '</div>';
  fcb += '<div class="flashcard-full-alt">' + fc.alt + '</div>';
  $('flashcard-back').innerHTML = fcb;
};
function _unsetFlashcard() {
  $('flashcard-front').innerHTML = '';
  $('flashcard-back').innerHTML = '';
}


// display the front of the flashcard
function showFrontFlashcard() {
  FC_STATUS = 'front';
  $('flashcard').classList.remove('back');
  $('flashcard').classList.add('front');
  var fcf = $('flashcard-front');
  var fcb = $('flashcard-back');
  fcf.parentNode.insertBefore(fcf,fcb);
  fcf.style.visibility = "visible";
  fcb.style.visibility = "hidden";
  fcf.style.opacity = "1";
  fcb.style.opacity = "0";
  _playAudioPrompt();
};

// display the back of the flashcard
// start timer if it's the first flip
function showBackFlashcard() {
  FC_STATUS = 'back';
  if (FIRST_FLIP) {
    startwatch();
    FIRST_FLIP = false;
  }
  $('flashcard').classList.remove('front');
  $('flashcard').classList.add('back');
  var fcf = $('flashcard-front');
  var fcb = $('flashcard-back');
  fcf.parentNode.insertBefore(fcb,fcf);
  fcf.style.visibility = "hidden";
  fcb.style.visibility = "visible";
  fcf.style.opacity = "0";
  fcb.style.opacity = "1";
  _playAudio();
};

// called when the user advances to the next card
function showNextFlashcard() {
  if (FIRST_FLIP) {
    //user is skipping this card (no score change, for now)
  } else {
    var wait_s = stopwatch();
    wait_s = wait_s < MAX_WAIT ? wait_s : MAX_WAIT;
    var oldscore = getScore(CURR_FC)
    setScore(CURR_FC, (oldscore*4 + wait_s)/5 );
  }
  FIRST_FLIP = true;
  _stopAudio();
  _nextFlashcard();
  _setFlashcard();
  showFrontFlashcard();
};

// flip card from front to back
function toggleFlashcard() {
  if (FC_STATUS === 'front') {
    return showBackFlashcard();
  } else {
    return showFrontFlashcard();
  }
};

// set the status message
function fcstat(msg) {
  document.getElementById('fc-status').innerHTML = msg;
};



// load the flashcard data from JSON
function loadDeck(url) {
  _showModal();
  fcstat('loading');
  getJSON(url, function(err, data) {
    if (err !== null) {
      console.log('Something went wrong: ' + err);
    } else {
      FC_DATA = data;
      initScores(url);
      FC_AUDIO = preloadAudio(FC_DATA);
      FC_AUDIO_PROMPT = preloadAudioP(FC_DATA);
      CURR_FC = 0;
      FIRST_FLIP = true;
      NEXT_UP = [];
      _nextFlashcard();
      _setFlashcard();
      showFrontFlashcard();
    }
  });
};

// pause the flashcards
function pause() {
  _stopAudio();
  _unsetFlashcard();
  FC_DATA = null;
  FC_AUDIO = null;
  FC_PROMPT = null;
  _closeModal();
}


// show flashcard-modal
function _showModal() {
  $('flashcard-modal').style.visibility = "visible";
}
function _closeModal() {
  $('flashcard-modal').style.visibility = "hidden";
}








//preload any audio files
function preloadAudio(data) {
  var audiof = new Array();
  for (var i=0; i<data.length; i++) {
    audiof[i] = false;
    if (data[i].audio) {
      audiof[i] = new Audio();
      audiof[i].addEventListener('canplaythrough', loadedAudio, false); 
      audiof[i].src = 'audio/' + data[i].audio;
    }
  }
  return audiof;
};
function preloadAudioP(data) {
  var audiof = new Array();
  for (var i=0; i<data.length; i++) {
    audiof[i] = false;
    if (data[i].audio_prompt) {
      audiof[i] = new Audio();
      audiof[i].addEventListener('canplaythrough', loadedAudio, false); 
      audiof[i].src = 'audio/' + data[i].audio_prompt;
    }
  }
  return audiof;
};
function loadedAudio() {
  console.log('audio ready?');
};

// attempt to play the current cards audio
function _playAudio() {
  if (FC_AUDIO[CURR_FC]) {
    var player = $('flashcard-audio');
    player.src = FC_AUDIO[CURR_FC].src
    player.play();
  }
};
function _playAudioPrompt() {
  if (FC_AUDIO_PROMPT[CURR_FC]) {
    var player = $('flashcard-audio');
    player.src = FC_AUDIO_PROMPT[CURR_FC].src
    player.play();
  }
};
function _stopAudio() {
  var player = $('flashcard-audio');
  player.pause();
};

