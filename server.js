const http = require('http')
const app = require('./app')
const fs = require('fs-extra')
const { spawn } = require('child_process')
const untildify = require('untildify')

const mm = require('magic-mongo')

const port = process.env.PORT || 3000
const server = http.createServer(app)
const io = require('socket.io')(server)

let frontClient, prevProgress
io.on('connection', (client) => {
    frontClient = client
    if (prevProgress)
        io.emit('progress', prevProgress)
})

io.on('disconnect', () => frontClient = null)

server.listen(port, () => {
    console.log(`Server running on port: ${port}`);
    // Initiate restore process
    const restoreProc = mm.restore({
        dir: process.env.WORKSPACE_PATH,
        db: process.env.MONGODB_URI
    }, err => {
        throw new Error(err)
    })
    restoreProc.on('data', progress => {
        console.log("Progress Listener Triggered, Current Progress: " + progress)
        if (frontClient)
            io.emit('progress', progress)
        prevProgress = progress
        if (progress === 100) {
            fs.ensureFileSync('/tmp/__RESTORE_COMPLETED__')
            const c9_proc = spawn('npm',
                ['run', 'initiate'], { cwd: '/root/proxy-server/c9/'})
            console.log(`Spawning C9 Process with PID: ${c9_proc.pid}`)
            c9_proc.stdout.on('data', (data) => {
                console.log(`C9 Process STDOUT: ${data.toString()}`);
            })
            c9_proc.stderr.on('data', (data) => {
                console.log(`C9 Process STDERR: ${data.toString()}`);
            })
            c9_proc.on('close', () => {
                console.log('C9 Process Exited.....')
            })
        }
    })
});
