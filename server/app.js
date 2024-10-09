const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Log file and log directory
const LOG_DIR = './logs';
const LOG_FILE = 'log.csv';
const MAX_LINES = 20;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

// Helper function to get log file path
const getLogFilePath = () => path.join(LOG_DIR, LOG_FILE);

// Ensure log file exists and create it with headers if not
function ensureLogFile() {
    const logFilePath = getLogFilePath();
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, 'Agent,Time,Method,Resource,Version,Status\n');
    }
}

// Rotate logs if necessary
function rotateLogs(callback) {
    ensureLogFile();
    const logFilePath = getLogFilePath();
    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) return console.error(err);
        
        const logs = data.split('\n');
        if (logs.length > MAX_LINES + 1) { // Account for the header row
            for (let i = MAX_LINES - 1; i >= 0; i--) {
                const oldLog = getLogFilePath(i ? i : '');
                const newLog = getLogFilePath(i + 1);
                if (fs.existsSync(oldLog)) {
                    fs.rename(oldLog, newLog, (err) => {
                        if (err) console.error(err);
                    });
                }
            }
            // Reset the log file after rotation
            fs.writeFile(logFilePath, 'Agent,Time,Method,Resource,Version,Status\n', (err) => {
                if (err) console.error(err);
            });
        }
        
        // Call the callback if provided
        if (callback) callback();
    });
}

// Log requests to the CSV file and console
function logRequest(req, res, statusCode) {
    const logLine = `${req.headers['user-agent'].replace(/,/g, ' ')},${new Date().toISOString()},${req.method},${req.url},HTTP/${req.httpVersion},${statusCode}\n`;

    // Log to console
    console.log(logLine.trim());
    
    // Append to the log file
    fs.appendFile(getLogFilePath(), logLine, (err) => {
        if (err) console.error(err);
    });
}

// Middleware to log the incoming request
app.use((req, res, next) => {
    res.on('finish', () => {
        logRequest(req, res, res.statusCode);  // Log the request
        rotateLogs();  // Rotate logs if necessary
    });
    next();
});

// Route to respond with "ok"
app.get('/', (req, res) => {
    res.send('ok');
});

// Route to return logs as JSON
app.get('/logs', (req, res) => {
    ensureLogFile();  // Ensure the log file exists
    const logFilePath = getLogFilePath();

    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ message: 'Log file not found' });
        }
        
        const logs = data.trim().split('\n').slice(1); // Skip the header row
        const logObjects = logs.map(line => {
            const [Agent, Time, Method, Resource, Version, Status] = line.split(',');
            return { Agent, Time, Method, Resource, Version, Status };
        });
        res.json(logObjects);
    });
});

// Handle 404 for unknown routes
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

const PORT = 3000; // Define the port to listen on
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;