var Auth = (function () {
    var USERS_KEY = 'apexledger_users';
    var SESSION_KEY = 'apexledger_auth';

    function uid() {
        return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function hashPassword(pw) {
        var str = String(pw);
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'h_' + hash + '_' + str.length;
    }

    function getUsers() {
        try {
            var raw = window.localStorage.getItem(USERS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveUsers(users) {
        window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function findUserByEmail(email) {
        var lower = String(email || '').trim().toLowerCase();
        var users = getUsers();
        for (var i = 0; i < users.length; i++) {
            if (users[i].email.toLowerCase() === lower) return users[i];
        }
        return null;
    }

    function findUserById(id) {
        var users = getUsers();
        for (var i = 0; i < users.length; i++) {
            if (users[i].id === id) return users[i];
        }
        return null;
    }

    function publicUser(u) {
        return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            createdAt: u.createdAt
        };
    }

    function setSession(userId) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: userId,
            loggedInAt: new Date().toISOString()
        }));
    }

    function getSession() {
        try {
            var raw = window.localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function logout() {
        window.localStorage.removeItem(SESSION_KEY);
    }

    function getCurrentUser() {
        var session = getSession();
        if (!session) return null;
        var user = findUserById(session.userId);
        return user ? publicUser(user) : null;
    }

    function isLoggedIn() {
        return !!getCurrentUser();
    }

    function register(data) {
        data = data || {};
        return new Promise(function (resolve, reject) {
            var email = String(data.email || '').trim();
            var password = String(data.password || '');

            if (!email) {
                reject(new Error('Email is required.'));
                return;
            }
            if (password.length < 6) {
                reject(new Error('Password must be at least 6 characters.'));
                return;
            }
            if (findUserByEmail(email)) {
                reject(new Error('An account with this email already exists.'));
                return;
            }

            var user = {
                id: uid(),
                firstName: String(data.firstName || '').trim(),
                lastName: String(data.lastName || '').trim(),
                email: email,
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString()
            };

            var users = getUsers();
            users.push(user);
            saveUsers(users);
            setSession(user.id);
            resolve(publicUser(user));
        });
    }

    function login(email, password) {
        return new Promise(function (resolve, reject) {
            var user = findUserByEmail(email);
            if (!user || user.passwordHash !== hashPassword(password)) {
                reject(new Error('Incorrect email or password.'));
                return;
            }
            setSession(user.id);
            resolve(publicUser(user));
        });
    }

    function updateProfile(userId, updates) {
        updates = updates || {};
        return new Promise(function (resolve, reject) {
            var users = getUsers();
            var idx = -1;
            for (var i = 0; i < users.length; i++) {
                if (users[i].id === userId) { idx = i; break; }
            }
            if (idx === -1) {
                reject(new Error('User not found.'));
                return;
            }

            if (typeof updates.email === 'string' && updates.email.trim()) {
                var trimmedEmail = updates.email.trim();
                var existing = findUserByEmail(trimmedEmail);
                if (existing && existing.id !== userId) {
                    reject(new Error('That email is already in use.'));
                    return;
                }
                users[idx].email = trimmedEmail;
            }
            if (typeof updates.firstName === 'string') {
                users[idx].firstName = updates.firstName.trim();
            }
            if (typeof updates.lastName === 'string') {
                users[idx].lastName = updates.lastName.trim();
            }

            saveUsers(users);
            resolve(publicUser(users[idx]));
        });
    }

    function changePassword(userId, currentPassword, newPassword) {
        return new Promise(function (resolve, reject) {
            var users = getUsers();
            var idx = -1;
            for (var i = 0; i < users.length; i++) {
                if (users[i].id === userId) { idx = i; break; }
            }
            if (idx === -1) {
                reject(new Error('User not found.'));
                return;
            }
            if (users[idx].passwordHash !== hashPassword(currentPassword)) {
                reject(new Error('Current password is incorrect.'));
                return;
            }
            if (!newPassword || String(newPassword).length < 6) {
                reject(new Error('New password must be at least 6 characters.'));
                return;
            }
            users[idx].passwordHash = hashPassword(newPassword);
            saveUsers(users);
            resolve(true);
        });
    }

    function deleteAccount(userId) {
        return new Promise(function (resolve, reject) {
            var users = getUsers();
            var next = users.filter(function (u) { return u.id !== userId; });
            if (next.length === users.length) {
                reject(new Error('User not found.'));
                return;
            }
            saveUsers(next);
            try {
                window.localStorage.removeItem('ApexLedger_data_' + userId);
            } catch (e) {}
            logout();
            resolve(true);
        });
    }

    return {
        register: register,
        login: login,
        logout: logout,
        getCurrentUser: getCurrentUser,
        isLoggedIn: isLoggedIn,
        updateProfile: updateProfile,
        changePassword: changePassword,
        deleteAccount: deleteAccount
    };
})();
