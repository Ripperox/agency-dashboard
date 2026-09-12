import http from 'http'
import { createApp } from './app'
import { config } from './config'
import { initSocket } from './socket'
import { startOverdueJob } from './jobs/overdue'

const app = createApp()
const server = http.createServer(app)

initSocket(server)
startOverdueJob()

server.listen(config.port, () => {
  console.log(`api listening on http://localhost:${config.port}`)
})
