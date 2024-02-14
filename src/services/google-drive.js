import axios from "axios"
import { google } from "googleapis"
import * as fs from "fs"
import { readFile } from "fs/promises"
import { RedisClient } from "../cache/redis.js"
import path from "path"
const baseUrl = "https://www.googleapis.com/drive/v3/files"
const chunkSize = 25 * 1024 // 256 KB chunks

async function getAccessToken() {
  const serviceAccountKey = JSON.parse(
    await readFile("./serviceAccountKey.json", "utf-8")
  )
  const { client_email, private_key } = serviceAccountKey
  const jwtClient = new google.auth.JWT(
    client_email,
    null,
    private_key,
    ["https://www.googleapis.com/auth/drive"],
    null
  )
  const token = await jwtClient.authorize()
  return token.access_token
}

const getFileInfo = async (fileId) => {
  //setting options in headers
  const response = await axios({
    method: "GET",
    url: `${baseUrl}/${fileId}`,
    params: {
      fields: "name,mimeType,size",
    },
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
    },
  })
  return response.data
}

const downloadFile = async (fileId) => {
  const fileInfo = await getFileInfo(fileId)
  const redisClient = RedisClient.getClient()
  const currentTimestamp = Date.now()
  const fileDownloadKeyName = `${fileId}-${currentTimestamp}-current-download`
  const fileDownloadTotalSize = `${fileId}-total-size`
  await redisClient.set(fileDownloadKeyName, 0)
  await redisClient.set(fileDownloadTotalSize, Number(fileInfo.size))
  const fileNameInfo = path.parse(fileInfo.name)
  const outputPath = `./downloads/${fileNameInfo.name}-${fileId}-${currentTimestamp}${fileNameInfo.ext}`
  const { data: readStream, status } = await axios({
    method: "GET",
    url: `${baseUrl}/${fileId}?alt=media`,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    responseType: "stream",
  })
  let size = 0
  let checkSumSize = 0
  if (status == 200) {
    // const uploadUrl = await getUploadSessionUri(
    //   fileInfo.name - currentTimestamp
    // )
    const destWriteStream = await fs.createWriteStream(outputPath)

    let bufferUploadData = Buffer.from([])
    let arra = []

    readStream.on("data", (dataAvailable) => {
      redisClient.incrby(fileDownloadKeyName, dataAvailable.length)
      size += dataAvailable.length
      bufferUploadData = Buffer.concat([bufferUploadData, dataAvailable])
      destWriteStream.write(dataAvailable)

      while (bufferUploadData.length > chunkSize) {
        const endByte = Math.min(chunkSize, bufferUploadData.length)
        console.log(endByte)
        const chunk = bufferUploadData.subarray(0, endByte)
        arra.push(chunk.length)
        const x = {
          beforelength: bufferUploadData.length,
        }
        bufferUploadData = bufferUploadData.subarray(endByte)
        x.afterLength = bufferUploadData.length
        console.log(x)
        checkSumSize += chunk.length
      }
      // if (arra.length == 2) process.exit(0)
    })
    readStream.on("end", () => {
      redisClient.del(fileDownloadKeyName)
      destWriteStream.end()
      console.log(size)
      console.log({ bufferUploadDataln: bufferUploadData.length })
      checkSumSize += bufferUploadData.length
      // console.log(arra)
      console.log(checkSumSize)
      // console.log(noofchunk)
    })
    readStream.on("error", async (error) => {
      await redisClient.del(fileDownloadKeyName)
      await redisClient.set(`${fileDownloadKeyName}-error`)
      //log error
    })
  }
  return `${fileId}-${currentTimestamp}`
}

const getStatus = async (requestId, operation) => {
  const sizeKey = `${requestId.split("-")[0]}-total-size`
  const currentKey = `${requestId}-current-${operation}`
  const redisClient = RedisClient.getClient()
  const [currentStatus, totalSize] = await Promise.all([
    redisClient.get(currentKey),
    redisClient.get(sizeKey),
  ])
  const completionPercentage = (currentStatus / totalSize) * 100
  return completionPercentage
}

const getUploadSessionUri = async (fileName) => {
  const response = await axios({
    url: `${baseUrl}?uploadType=resumable`,
    method: "POST",
    data: { name: fileName },
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  })
  return response.headers.location
}

;() => {
  const resumableSessionUri = response.headers.location

  // Step 2: Upload the file in chunks
  const chunkSize = 256 * 1024 // 256 KB chunks
  let startByte = 0

  const uploadChunk = () => {
    const endByte = Math.min(startByte + chunkSize, fileSize)
    const chunk = fs.createReadStream(filePath, {
      start: startByte,
      end: endByte - 1,
    })

    axios.put(resumableSessionUri, chunk, {
      headers: {
        "Content-Range": `bytes ${startByte}-${endByte - 1}/${fileSize}`,
      },
    })
  }
}

const uploadFile = () => {}

export default {
  downloadFile,
  getStatus,
  getUploadSessionUri,
}
