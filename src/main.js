import express from "express"
import dotenv from "dotenv"
// import googledriverouter from "./routers/google-drive-router"
import googleDriveService from "./services/google-drive.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 8080

// app.use(router)

// app.listen(port, () => {
//   console.log(`Server is running at http://localhost:${port}`)
// })

const key = await googleDriveService.downloadFile(
  "1ho4fHflbkLuuV_1yzTKIpGsxx8oReIMC"
)

// console.log(await googleDriveService.getUploadSessionUri("1234test.pdf"))

export { app }
