```markdown
# 🎰 777Casino Web Application

![GitHub Stars](https://img.shields.io/github/stars/yourusername/casino-webapp?style=flat-square)
![GitHub Forks](https://img.shields.io/github/forks/yourusername/casino-webapp?style=flat-square)
![GitHub Issues](https://img.shields.io/github/issues/yourusername/casino-webapp?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A visually stunning, responsive online casino web application with a rich CSS styling framework, complete with game mechanics, user authentication, and a comprehensive admin panel.

---

## ✨ Features

✅ **Immersive Casino Experience** - Beautiful, high-quality UI with a luxurious casino theme
✅ **Multiple Game Types** - Blackjack, Poker, Roulette, Slot Machines, and Crash Games
✅ **User Authentication** - Secure login system with Supabase integration
✅ **VIP Program** - Tiered rewards system with visual progress tracking
✅ **Responsive Design** - Works seamlessly on desktop and mobile devices
✅ **Admin Panel** - Comprehensive dashboard for managing users, transactions, and promotions
✅ **Real-time Chat** - Live support widget for customer assistance
✅ **Multiplayer Support** - Social gaming features for competitive play
✅ **Responsive Layout** - Adaptive design for all screen sizes
✅ **Modern CSS Architecture** - Clean, maintainable stylesheets with modular components

---

## 🛠️ Tech Stack

**Primary Language:** CSS (with HTML, JavaScript, and PHP for backend)

**Frontend:**
- HTML5
- CSS3 (Sass-like modular structure)
- JavaScript (ES6+)
- Supabase (Authentication & Database)

**Backend:**
- PHP
- MySQL

**Tools:**
- Git
- Node.js (for build scripts)
- Webpack (for asset bundling)
- Chart.js (for statistics visualization)

---

## 📦 Installation

### Prerequisites

Before you begin, ensure you have met the following requirements:

- **Node.js** (v14 or higher)
- **PHP** (v7.4 or higher)
- **MySQL** (v5.7 or higher)
- **Supabase Account** (for authentication and database)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/casino-webapp.git
   cd casino-webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   ```bash
   # Import the SQL schema from the /sql directory into your MySQL server
   ```

4. **Configure Supabase:**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Update the Supabase credentials in `scripts/supabase-client.js`

5. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your specific configurations.

6. **Extract CSS from HTML files:**
   ```bash
   python extract_css.py
   ```

7. **Fix encoding issues:**
   ```bash
   python fix_advanced.py
   python fix_last.py
   python fix_ticker.py
   ```

8. **Start the development server:**
   ```bash
   npm run dev
   ```

9. **Access the application:**
   Open your browser to `http://localhost:3000`

---

## 🎯 Usage

### Basic Usage

The casino application is designed to be self-contained and ready to use. Here's how to get started with the main features:

#### Game Navigation
```css
/* Example of how to style game navigation elements */
.nav-links a {
    color: var(--gold-dim);
    transition: all 0.25s;
    padding: 12px 16px;
    border-radius: 4px;
}

.nav-links a:hover {
    color: var(--gold);
    background: rgba(255, 215, 0, 0.1);
}
```

#### Game Mechanics (Blackjack Example)
```css
/* CSS for Blackjack game interface */
.game-container {
    max-width: 820px;
    margin: 0 auto;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 0 0 3px #a07840, 0 30px 80px rgba(0,0,0,0.9);
}

.table-felt {
    background:
        radial-gradient(ellipse 100% 70% at 50% 40%, #1e7d3c 0%, #0d4a1e 65%, #062a10 100%);
    border: 14px solid #5c3a1e;
    border-bottom: none;
    padding: 28px 28px 20px;
    text-align: center;
    box-shadow: inset 0 0 80px rgba(0,0,0,0.5);
}
```

#### User Authentication
The application uses Supabase for authentication. Here's how to integrate it in your JavaScript:

```javascript
// Example of Supabase authentication in auth.js
async function loginUser(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login error:", error.message);
        return null;
    }

    return data.user;
}
```

### Advanced Usage

#### Customizing Game Themes
The casino application uses a sophisticated CSS architecture. To customize game themes:

1. **Locate the game-specific CSS files** in the `styles/` directory (e.g., `blackjack.css`, `poker.css`).
2. **Modify the variables** in the `:root` section to change colors and styles.
3. **Extend or override** existing styles with your custom CSS.

```css
/* Example of customizing the Blackjack theme */
:root {
    --bg: #0a1a0a;
    --accent: #800000;
    --gold: #FFD700;
    --gold-dim: #D4AF37;
}

.table-felt {
    background:
        radial-gradient(ellipse 100% 70% at 50% 40%, #1e7d3c 0%, #0d4a1e 65%, #062a10 100%);
}
```

#### Admin Panel Customization
The admin panel is designed with a dark theme and a terminal-inspired UI. To customize it:

1. **Locate `styles/admin.css`** in the project.
2. **Modify the CSS variables** at the top of the file to change colors and styles.
3. **Extend the existing components** with your custom styles.

```css
/* Example of customizing admin panel colors */
:root {
    --bg: #080b10;
    --accent: #e8b84b;
    --text: #d4d8e0;
}
```

---

## 📁 Project Structure

```
casino-webapp/
├── assets/
│   ├── fonts/
│   └── icons/
├── html/
│   ├── admin.html
│   ├── blackjack.html
│   ├── chi-siamo.html
│   ├── contatti.html
│   ├── giochi.html
│   ├── index.html
│   ├── login.html
│   ├── poker.html
│   ├── promozioni.html
│   ├── registrati.html
│   ├── ricarica.html
│   ├── rocket.html
│   ├── roulette.html
│   ├── slot.html
│   ├── termini.html
│   ├── user.html
│   └── [other game pages]
├── php/
│   ├── admin_api.php
│   ├── balance.php
│   ├── contatti.php
│   ├── create_admin.php
│   ├── db_config.php
│   ├── elabora_ricarica.php
│   ├── logout.php
│   ├── messaggi.json
│   ├── set_session.php
│   └── user.php
├── scripts/
│   ├── admin.js
│   ├── auth.js
│   ├── balance.js
│   ├── blackjack.js
│   ├── chat.js
│   ├── init.js
│   ├── lobby.js
│   ├── main.js
│   ├── multiplayer-engine.js
│   ├── poker.js
│   ├── rocket.js
│   ├── roulette.js
│   ├── slot.js
│   ├── statistiche.js
│   ├── supabase-client.js
│   ├── tavolo-config.js
│   ├── verificacarta.js
│   └── [other game scripts]
├── styles/
│   ├── admin.css
│   ├── auth.css
│   ├── blackjack.css
│   ├── chat.css
│   ├── index.css
│   ├── layout.css
│   ├── main.css
│   ├── [other game styles]
├── .env.example
├── README.md
└── [Python scripts for CSS extraction and fixing]
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory based on the `.env.example` template:

```env
# Supabase Configuration
SUPABASE_URL=https://your-supabase-project-url.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=casino_v1

# Application Settings
APP_ENV=development
APP_DEBUG=true
```

### CSS Configuration

The application uses a modular CSS architecture. Key configuration points:

1. **CSS Variables:** Define your theme colors and styles in the `:root` section of your CSS files.
2. **Component Overrides:** Extend or override existing components in your custom CSS files.
3. **Game-Specific Styling:** Each game has its own CSS file in the `styles/` directory.

### Customization Options

1. **Game Limits:** Configure minimum and maximum bet limits in the `tavolo-config.js` file.
2. **VIP Levels:** Define VIP level thresholds and rewards in the `statistiche.js` file.
3. **Promotions:** Manage promotions and bonuses in the `promozioni.html` and related PHP files.

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can contribute to the project:

### How to Contribute

1. **Fork the Project:**
   - Click the "Fork" button at the top right of this repository.

2. **Clone Your Fork:**
   ```bash
   git clone https://github.com/yourusername/casino-webapp.git
   cd casino-webapp
   ```

3. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes:**
   - Implement your feature or fix a bug.
   - Ensure your code follows the project's style guidelines.

5. **Test Your Changes:**
   - Run the application locally to test your changes.
   - Verify that all functionality works as expected.

6. **Commit Your Changes:**
   ```bash
   git add .
   git commit -m "Add your descriptive commit message"
   ```

7. **Push to the Branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request:**
   - Go to the original repository on GitHub.
   - Click "New Pull Request" and select your branch.
   - Fill in the PR template with details about your changes.

### Development Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set Up the Database:**
   - Import the SQL schema from the `/sql` directory into your MySQL server.

3. **Configure Supabase:**
   - Create a Supabase project and update the credentials in `scripts/supabase-client.js`.

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

### Code Style Guidelines

1. **CSS:**
   - Use a consistent naming convention (BEM-like).
   - Organize styles by component and feature.
   - Use CSS variables for theming and consistency.
   - Keep selectors specific but not overly complex.

2. **JavaScript:**
   - Use ES6+ features.
   - Follow a consistent indentation style (2 spaces).
   - Write modular, reusable functions.
   - Use meaningful variable and function names.

3. **HTML:**
   - Use semantic HTML5 elements.
   - Keep the structure clean and organized.
   - Use comments to explain complex sections.

4. **General:**
   - Write clear, concise comments.
   - Follow the project's existing style and patterns.
   - Ensure your code is well-tested.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors & Contributors

### Maintainers

- **RI.ROSSI** - Initial work and development

### Contributors

- [Your Name](https://github.com/yourusername) - Your contributions
- [Another Contributor](https://github.com/anotherusername) - Your contributions

---

## 🐛 Issues & Support

### Reporting Issues

If you encounter any issues or have suggestions for improvement, please open an issue on the GitHub repository. When reporting an issue, please include:

- A clear description of the problem.
- Steps to reproduce the issue.
- Any relevant screenshots or error messages.
- Your environment details (browser, OS, etc.).

### Getting Help

- **Community Support:** Join our Discord server for real-time help and discussions.
- **Documentation:** Check out the project documentation for detailed guides.
- **FAQ:** Common questions and answers can be found in the project's FAQ section.

---

## 🗺️ Roadmap

### Planned Features

- **Leaderboards:** Add a global leaderboard for top players.
- **Achievement System:** Implement an achievement system for players.
- **Advanced Statistics:** Add more detailed player statistics and analytics.
- **Mobile App:** Develop a companion mobile application.
- **Multi-Language Support:** Add support for additional languages.
- **Enhanced Security:** Implement additional security measures and compliance features.

### Known Issues

- **Issue 1:** Some CSS styles may not be fully responsive on very small screens.
- **Issue 2:** The multiplayer functionality requires additional testing for stability.
- **Issue 3:** Admin panel could benefit from additional user role permissions.

### Future Improvements

- **Performance:** Optimize the application for faster load times.
- **Accessibility:** Improve accessibility features for users with disabilities.
- **Customization:** Add more options for users to customize their gaming experience.
- **Community Features:** Implement forums, tournaments, and other community features.

---

## 🎉 Get Started Today!

Join the 777Casino community and start building your own casino web application today. Whether you're looking to contribute to the project, use it as a template for your own casino, or simply explore the code, we invite you to be part of this exciting project.

👉 **Star this repository** to show your support and stay updated with the latest developments!

💬 **Join our community** for discussions, support, and collaboration opportunities.

🚀 **Contribute to the project** by submitting pull requests and helping us improve the application.

Thank you for your interest in the 777Casino Web Application!
```