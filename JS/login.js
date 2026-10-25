var REMEMBER_EMAIL_KEY = 'apexledger_remember_email';

var loginForm = document.getElementById("loginForm");
var forgot = document.getElementById("forgot");
var err = document.getElementById("err");
var emailInput = document.getElementById("email");
var rememberInput = document.getElementById("remember");

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

(function prefillEmail() {
  try {
    var remembered = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (remembered) {
      emailInput.value = remembered;
      rememberInput.checked = true;
    }
  } catch (e) {}
})();

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  hideErr();

  if (!loginForm.checkValidity()) {
    return;
  }

  var email = emailInput.value.trim();
  var password = document.getElementById("password").value;

  try {
    await Auth.login(email, password);

    try {
      if (rememberInput.checked) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (e) {}

    window.location.href = "dashboard.html";
  } catch (err) {
    showErr(err.message || "Could not sign in. Please try again.");
  }
});

forgot.addEventListener("click", function (event) {
  event.preventDefault();
  alert("Password reset option selected.");
});