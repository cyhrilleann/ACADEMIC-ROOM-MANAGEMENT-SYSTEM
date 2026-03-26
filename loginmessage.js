        const correctUsername = "comptechacademic";
        const correctPassword = "ar2026";

        const form = document.getElementById("login-form");
        const errorMessage = document.getElementById("error-message");

        form.addEventListener("submit", function(event) {
            event.preventDefault(); 

            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            if(username === correctUsername && password === correctPassword) {
                window.location.href = "home.html"
            } else {
                errorMessage.textContent = "Invalid username or password!"
                form.reset();
            }
        });
