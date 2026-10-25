if (typeof Auth !== "undefined" && Auth.isLoggedIn()) {
    var loginLink = document.getElementById("loginLink");
    var signupLink = document.getElementById("signupLink");
    var heroBtn = document.getElementById("heroBtn");
    var pricingBtn = document.getElementById("pricingBtn");

    if (loginLink) {
        loginLink.textContent = "Dashboard";
        loginLink.href = "dashboard.html";
    }
    if (signupLink) {
        signupLink.textContent = "Go to Dashboard";
        signupLink.href = "dashboard.html";
    }
    if (heroBtn) {
        heroBtn.innerHTML = 'Go to Dashboard <span class="arrow">↗</span>';
        heroBtn.href = "dashboard.html";
    }
    if (pricingBtn) {
        pricingBtn.innerHTML = 'Go to Dashboard <span class="arrow">↗</span>';
        pricingBtn.href = "dashboard.html";
    }
}

var howBtn = document.getElementById("howBtn");
var howSection = document.getElementById("how");

howBtn.addEventListener("click", function () {
    howSection.scrollIntoView({
        behavior: "smooth"
    });
});

var overviewBtn = document.getElementById("overviewBtn");
var overviewSection = document.getElementById("overview");

if (overviewBtn) {
    overviewBtn.addEventListener("click", function () {
        overviewSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}

var featuresBtn = document.getElementById("featuresBtn");
var featuresSection = document.getElementById("features");

if (featuresBtn) {
    featuresBtn.addEventListener("click", function () {
        featuresSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}

var goalsBtn = document.getElementById("goalsBtn");
var goalsSection = document.getElementById("how");

if (goalsBtn) {
    goalsBtn.addEventListener("click", function () {
        goalsSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}

var insightsBtn = document.getElementById("insightsBtn");
var insightsSection = document.getElementById("deep-insights");

if (insightsBtn) {
    insightsBtn.addEventListener("click", function () {
        insightsSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}

var pricingBtn = document.getElementById("pricingBtn");
var pricingSection = document.getElementById("pricing");

if (pricingBtn) {
    pricingBtn.addEventListener("click", function () {
        pricingSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}