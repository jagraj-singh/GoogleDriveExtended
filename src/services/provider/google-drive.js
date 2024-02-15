import axios from "axios"
import { google } from "googleapis"
import * as fs from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { ArrayWithEvent } from "../../helper/buffer.js" //custom buffer array to help with upload of chunks in series
import { CacheProviders } from "../../cache/cache-factory.js"

const baseUrl = "https://www.googleapis.com/drive/v3/files" //base url for getting drive files
const chunkSize = 10 * 1024 * 1024 //10MB chunk size

/*
Method : getAccessToken
Description : To generate access token given a service account
 */
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

/*
Method : getFileInfo
Description : To get file information for google drive get api
Input : 
  fileId : string
 */
const getFileInfo = async (fileId) => {
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

/*
Method : downloadAndUploadFile
Description : Given a fileId it downloads and upload a file simultaneously
Input : 
  fileId : string
 */
const downloadAndUploadFile = async (fileId) => {
  let fileInfo
  try {
    fileInfo = await getFileInfo(fileId) //get information about file
  } catch (error) {
    return { error }
  }
  const redisClient = CacheProviders.Redis()
  const currentTimestamp = Date.now()

  //using redis to maintain download and upload status. Initialising keys here
  const fileDownloadProgressKey = `${fileId}-${currentTimestamp}-current-download`
  const fileUploadProgressKey = `${fileId}-${currentTimestamp}-current-upload`
  const fileTotalSizeKey = `${fileId}-${currentTimestamp}-total-size`
  await redisClient.set(fileDownloadProgressKey, 0)
  await redisClient.set(fileUploadProgressKey, 0)
  await redisClient.set(fileTotalSizeKey, Number(fileInfo.size))

  //parsing file name for getting name and extension
  const fileNameInfo = path.parse(fileInfo.name)

  //output path where file will be stored. Using current timestamp for identifying unique request
  const outputPath = `./downloads/${fileNameInfo.name}-${fileId}-${currentTimestamp}${fileNameInfo.ext}`
  try {
    //getting stream and status from drive.get
    const { data: readStream, status } = await axios({
      method: "GET",
      url: `${baseUrl}/${fileId}?alt=media`,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      responseType: "stream",
    })

    //if success in getting stream
    if (status == 200) {
      //geting resumable upload link
      const resumableUploadUrl = await getUploadSessionUri(
        `${fileNameInfo.name}-${currentTimestamp}-${fileNameInfo.ext}`
      )
      //creating output stream for writing file
      const destWriteStream = await fs.createWriteStream(outputPath)

      let bufferUploadData = Buffer.from([]) //used to form equal size chunks
      let chunksBuffer = new ArrayWithEvent() //used to buffer obtained chunks while downloading
      let contentRange = 0 //used to set headers for upload
      let uploadingData = true //used to identify when to stop uploading

      //if data is available in stream
      readStream.on("data", (dataAvailable) => {
        //write data to destination
        destWriteStream.write(dataAvailable)
        //concat the data to buffer. [data doesn't come in fixed sizes. So we have to furm fixed size chunks ourselves]
        bufferUploadData = Buffer.concat([bufferUploadData, dataAvailable])
        //increase the download progress key
        redisClient.incrby(fileDownloadProgressKey, dataAvailable.length)

        //forming chunks of fixed size
        while (bufferUploadData.length > chunkSize) {
          const endByte = Math.min(chunkSize, bufferUploadData.length)
          const chunk = bufferUploadData.subarray(0, endByte)

          //upload chunk from here
          bufferUploadData = bufferUploadData.subarray(endByte)
          //adding chunk to buffer
          chunksBuffer.addElement(chunk)

          if (chunksBuffer.getBufferLength() == 1) {
            //letting the buffer class know that first element has been added. Hence now we can start uploading
            chunksBuffer.firstElementAdded()
          }
        }
      })

      readStream.on("end", async () => {
        redisClient.del(fileDownloadProgressKey)
        destWriteStream.end()
        chunksBuffer.addElement(bufferUploadData)
      })

      readStream.on("error", async (error) => {
        await redisClient.del(fileDownloadProgressKey)
        await redisClient.set(`${fileDownloadProgressKey}-error`)
        //log error
      })

      //starting upload as soon as buffer starts receiving data
      chunksBuffer.on("firstElementAdded", async () => {
        while (uploadingData) {
          const currentElement = chunksBuffer.getCurrentElement() //getting first element from chunk. Also the chunk gets removed from buffer for memory save
          if (currentElement) {
            try {
              await axios.put(resumableUploadUrl, currentElement, {
                headers: {
                  "Content-Range": `bytes ${contentRange}-${
                    contentRange + currentElement.length - 1
                  }/${fileInfo.size}`,
                  "Content-Length": `${currentElement.length}`,
                },
              })
            } catch (err) {
              if (err.response.status != 308) {
                throw err
              }
            }
            contentRange += currentElement.length
            //updating upload progress
            await redisClient.incrby(
              fileUploadProgressKey,
              currentElement.length
            )
          } else {
            redisClient.del(fileUploadProgressKey)
            uploadingData = false
          }
        }
      })
    }
    //returning requestId which will be used by get status to check progress
    return `${fileId}-${currentTimestamp}`
  } catch (error) {
    return { error }
  }
}

/*
Method : getStatus
Description : Given requestid and operation it returns the progress of operation
Input : 
  requestId : string
  operation : string
 */
const getStatus = async (requestId, operation) => {
  const sizeKey = `${requestId}-total-size`
  const currentKey = `${requestId}-current-${operation}`
  const redisClient = CacheProviders.Redis()
  const [currentStatus, totalSize] = await Promise.all([
    redisClient.get(currentKey),
    redisClient.get(sizeKey),
  ])
  //current key is deleted after operation completion
  if (currentStatus == null || totalSize == null) {
    return -1
  }
  const completionPercentage = (currentStatus / totalSize) * 100
  return completionPercentage
}

/*
Method : getUploadSessionUri
Description : Ro create resumable upload session
Input : 
  fileName : string
  parents : Array
 */
const getUploadSessionUri = async (fileName) => {
  const response = await axios({
    url: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
    method: "POST",
    data: { name: fileName, parents: ["1swy2lHZ5h4tlLhScqp43Y_yDoa4DSBvz"] },
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  })
  return response.headers.location
}

export default {
  downloadAndUploadFile,
  getStatus,
}
