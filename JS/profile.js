var currentUser = null;

function showNotice(el, message, kind) {
  el.textContent = message;
  el.className = 'notice ' + kind;
  el.style.display = 'block';
}

function hideNotice(el) {
  el.style.display = 'none';
}

function loadCurrentUser() {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return null;
  }
  var user = Auth.getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function fillProfileForm(user) {
  document.getElementById('pfname').value = user.firstName || '';
  document.getElementById('plname').value = user.lastName || '';
  document.getElementById('pemail').value = user.email || '';
}

function init() {
  currentUser = loadCurrentUser();
  if (!currentUser) return;

  fillProfileForm(currentUser);

  var profileForm = document.getElementById('profile-form');
  var profileNotice = document.getElementById('profile-notice');

  profileForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideNotice(profileNotice);

    var firstName = document.getElementById('pfname').value.trim();
    var lastName = document.getElementById('plname').value.trim();
    var email = document.getElementById('pemail').value.trim();

    try {
      var updated = await Auth.updateProfile(currentUser.id, {
        firstName: firstName,
        lastName: lastName,
        email: email
      });
      currentUser = updated;
      fillProfileForm(currentUser);
      showNotice(profileNotice, 'Profile updated.', 'success');
    } catch (err) {
      showNotice(profileNotice, err.message || 'Could not update profile.', 'error');
    }
  });

  var passwordForm = document.getElementById('password-form');
  var passwordNotice = document.getElementById('password-notice');

  passwordForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideNotice(passwordNotice);

    var currentPassword = document.getElementById('current-password').value;
    var newPassword = document.getElementById('new-password').value;
    var confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      showNotice(passwordNotice, 'New passwords do not match.', 'error');
      return;
    }

    try {
      await Auth.changePassword(currentUser.id, currentPassword, newPassword);
      passwordForm.reset();
      showNotice(passwordNotice, 'Password updated.', 'success');
    } catch (err) {
      showNotice(passwordNotice, err.message || 'Could not update password.', 'error');
    }
  });

  document.getElementById('delete-account-btn').addEventListener('click', async function () {
    var confirmed = window.confirm(
      'This will permanently delete your account and all of your ApexLedger data. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      await Auth.deleteAccount(currentUser.id);
      window.location.href = 'index.html';
    } catch (err) {
      showNotice(profileNotice, err.message || 'Could not delete account.', 'error');
    }
  });
}

init();

