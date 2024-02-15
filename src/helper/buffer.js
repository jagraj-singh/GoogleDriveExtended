import { EventEmitter } from "events"

export class ArrayWithEvent extends EventEmitter {
  constructor() {
    super()
    this.array = []
    this.firstElementAddedAlready = false
  }

  addElement(element) {
    this.array.push(element)
  }

  firstElementAdded() {
    if (this.firstElementAddedAlready == false) this.emit("firstElementAdded")
    this.firstElementAddedAlready = true
  }

  getCurrentElement() {
    return this.array.shift()
  }

  getBufferLength() {
    return this.array.length
  }
}
