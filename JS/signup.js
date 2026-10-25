var form = document.getElementById("signupForm");
var pass = document.getElementById("pass");
var bars = document.querySelectorAll(".strength span");
var err = document.getElementById("err");

function showErr(msg) {
  err.textContent = msg;
  err.style.display = "block";
}

function hideErr() {
  err.style.display = "none";
}

if (typeof Auth !== "undefined" && Auth.isLoggedIn()) {
  window.location.href = "dashboard.html";
}

function scorePass(val) {
  var score = 0;

  if (val.length >= 6) {
    score++;
  }

  if (val.length >= 10) {
    score++;
  }

  if (/[0-9]/.test(val)) {
    score++;
  }

  if (/[A-Z]/.test(val)) {
    score++;
  }

  return score;
}

pass.addEventListener("input", function () {
  var score = scorePass(pass.value);

  for (var i = 0; i < bars.length; i++) {
    if (i < score) {
      bars[i].classList.add("active");
    } else {
      bars[i].classList.remove("active");
    }
  }
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  hideErr();

  if (!form.checkValidity()) {
    return;
  }

  var firstName = document.getElementById("fname").value.trim();
  var lastName = document.getElementById("lname").value.trim();
  var email = document.getElementById("email").value.trim();
  var password = pass.value;
  var termsAccepted = document.getElementById("terms").checked;

  if (!termsAccepted) {
    showErr("Please agree to the Terms of Service and Privacy Policy.");
    return;
  }

  if (scorePass(password) < 2) {
    showErr("Choose a stronger password — at least 6 characters, ideally with a number.");
    return;
  }

  try {
    await Auth.register({
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: password
    });

    window.location.href = "dashboard.html";
  } catch (err) {
    showErr(err.message || "Could not create your account. Please try again.");
  }
});