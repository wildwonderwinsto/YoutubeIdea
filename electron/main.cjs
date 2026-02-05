const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//     app.quit();
// }

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, '../public/favicon-eye.svg'), // Use existing favicon if possible, or convert to .ico later
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Determine if we are in development or production
    const isDev = !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        // The dist folder will be at the root of the app resources
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

// Function to start the backend server
function startServer() {
    const isDev = !app.isPackaged;

    if (isDev) {
        console.log('In dev mode, assuming server is running via npm start separately or concurrently');
        return;
    }

    // Path to the bundled server
    // We need to ensure we bundle the 'server' directory into the build
    const serverPath = path.join(process.resourcesPath, 'server', 'index.js');

    console.log(`Starting server from: ${serverPath}`);

    if (fs.existsSync(serverPath)) {
        // Spawn the node process
        // We assume 'node' is available or bundled?
        // Electron doesn't bundle node executable for spawning usually without extra work.
        // HOWEVER, for a simple implementation, we can try to rely on user's node or bundle it.
        // A more robust way for electron apps is to embed the backend logic directly or use a binary.
        // For this plan, we will try to spawn 'node' assuming it's in PATH or use built-in node integration? 
        // No, node integration is renderer side. Main process has node.
        // We can require() the server index IF it exports a start function, but it probably runs on top-level.

        // Better approach for "bundled" server without complex binaries:
        // require video-analysis server in the main process?
        // The server uses express. We can run it right here in the main process!
        // This avoids needing a separate node process and port management issues usually.
        // Let's TRY to require it.

        try {
            // We need to set ENV vars that the server expects
            process.env.PORT = 3000;
            process.env.NODE_ENV = 'production';
            // Add other env vars here or load from a file if needed

            // IMPORTANT: The server likely does `app.listen(port)` at the bottom.
            // If we require it, it will start.
            require(serverPath);
            console.log('Backend server started internally.');
        } catch (err) {
            console.error('Failed to start internal backend:', err);
        }
    } else {
        console.error(`Server file not found at ${serverPath}`);
    }
}

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// kill child process if we spawned one (if we switched back to spawn)
app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
