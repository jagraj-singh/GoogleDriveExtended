import axios from "axios"
import { Router } from "express"
import bodyParser from "body-parser"
import { ServiceProviders } from "../services/service-factory.js"

const router = Router()

router.use("/v1/download-and-copy", bodyParser.json())
router.post("/v1/download-and-copy", async (req, res) => {
  const fileId = req.body.fileId
  if (!fileId) {
    return res.status(400).json({ error: "Missing required parameter: fileId" })
  }
  if (typeof fileId !== "string") {
    return res.status(400).json({ error: "fileId should be of type string" })
  }
  const service = ServiceProviders.Google_Drive
  try {
    const resp = await service.downloadAndUploadFile(fileId)
    res.json({ requestId: resp })
  } catch (error) {
    if (axios.isAxiosError(error))
      res.status(error.response.status).json(error.message)
    else res.status(400).json(error.message)
  }
})

router.get("/v1/status", async (req, res) => {
  if (!req.query.requestId) {
    return res
      .status(400)
      .json({ error: "Missing required query parameter: requestId" })
  }
  if (typeof req.query.requestId !== "string") {
    return res.status(400).json({ error: "requestId should be of type string" })
  }
  if (!req.query.operation) {
    return res
      .status(400)
      .json({ error: "Missing required query parameter: operation" })
  }
  if (typeof req.query.operation !== "string") {
    return res.status(400).json({ error: "operation should be of type string" })
  }
  const allowedOperaions = ["upload", "download"]
  if (!allowedOperaions.includes(req.query.operation)) {
    return res
      .status(400)
      .json({ error: "operation should be one of upload/download" })
  }
  const service = ServiceProviders.Google_Drive
  const resp = await service.getStatus(req.query.requestId, req.query.operation)
  res.json({ percentage: resp })
})

export default router
