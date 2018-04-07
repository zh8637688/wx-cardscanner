var upng = require('./upng-js/UPNG.js')
var ocr = require('./ocrapi/ocr.js')
var Promise = require('./promise.js')

const canvasID = 'scannerCanvas'
const actionTypes = ['ImageChanged', 'DecodeStart', 'DecodeComplete']

export default class CardScanner {
  constructor(page) {
    this.page = page
    this.canvas = wx.createCanvasContext(canvasID)
    page.cardScanner = this
    page.bindChooseImg = this.bindChooseImg
    page.bindConfirm = this.bindConfirm
  }

  setImage(imgFilePath) {
    if (imgFilePath) {
      let that = this
      this.img = {
        path: imgFilePath
      }
      this._getImgSize(this.img)
        .then((img) => {
          return that._getCanvasSize()
        })
        .then(() => {
          that._calcTarget()
          that._drawTarget()
        })
    }
  }

  bindChooseImg(e) {
    let scanner = this.cardScanner
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: function (res) {
        scanner.onImageChanged && scanner.onImageChanged(res.tempFilePaths[0])
        scanner.setImage(res.tempFilePaths[0])
      },
      fail(e) {
        console.error(e)
      }
    })
  }

  bindConfirm(e) {
    let scanner = this.cardScanner
    if (scanner.finishDraw) {
      scanner.onDecodeStart && scanner.onDecodeStart()
      scanner._decodeTarget()
    } else {
      console.log('绘制未完成')
    }
  }

  on(action, callback) {
    if (actionTypes.indexOf(action) > -1 && typeof (callback) === 'function') {
      this['on' + action] = callback
    }
    return this
  }

  _getImgSize(img) {
    return new Promise(resolve => {
      if (img.width && img.height) {
        resolve(img)
      } else {
        let that = this
        wx.getImageInfo({
          src: img.path,
          success(res) {
            img['radio'] = res.width / res.height
            img['width'] = res.width
            img['height'] = res.height
            resolve(img)
          },
          fail(e) {
            console.error(e)
          }
        })
      }
    })
  }

  _getCanvasSize() {
    let that = this
    return new Promise(resolve => {
      if (that.canvasSize) {
        resolve()
      } else {
        wx.createSelectorQuery().select('#' + canvasID).boundingClientRect((res) => {
          that.canvasSize = {
            radio: res.width / res.height,
            width: res.width,
            height: res.height
          }
          resolve()
        }).exec()
      }
    })
  }

  _calcTarget() {
    let target = {}
    if (this.img.radio > this.canvasSize.radio) {
      target['width'] = this.canvasSize.width
      target['height'] = target['width'] / this.img.radio
      target['top'] = (this.canvasSize.height - target['height']) / 2
      target['left'] = 0
    } else {
      target['height'] = this.canvasSize.height
      target['width'] = target['height'] * this.img.radio
      target['left'] = (this.canvasSize.width - target['width']) / 2
      target['top'] = 0
    }
    this.target = target
  }

  _drawTarget() {
    let that = this
    this.finishDraw = false
    this.canvas.drawImage(this.img.path, this.target.left, this.target.top, this.target.width, this.target.height)
    this.canvas.draw(false, () => {
      that.finishDraw = true
    })
  }

  _decodeTarget() {
    let that = this
    this._getTargetImgData()
      .then((res) => {
        return that._toPNGBase64(res.buffer, res.width, res.height)
      })
      .then((base64) => {
        return that._requestOCR(base64)
      })
      .then(res => {
        that.onDecodeComplete && that.onDecodeComplete({
          code: 0,
          data: res
        })
      })
      .catch(error => {
        that.onDecodeComplete && that.onDecodeComplete(error)
      })
  }

  _getTargetImgData() {
    let that = this
    return new Promise((resolve, reject) => {
      wx.canvasGetImageData({
        canvasId: canvasID,
        x: that.target.left,
        y: that.target.top,
        width: that.target.width,
        height: that.target.height,
        success(res) {
          resolve({
            buffer: res.data.buffer,
            width: res.width,
            height: res.height
          })
        },
        fail(e) {
          reject({
            code: 1,
            reason: '读取图片数据失败'
          })
        }
      })
    })
  }

  _toPNGBase64(buffer, width, height) {
    return new Promise((resolve, reject) => {
      try {
        let pngData = upng.encode([buffer], width, height)
        resolve(wx.arrayBufferToBase64(pngData))
      } catch (e) {
        reject({
          code: 2,
          reason: '图片转base64失败'
        })
      }
    })
  }

  _requestOCR(base64) {
    return new Promise((resolve, reject) => {
      ocr.request(base64, {
        success(res) {
          resolve(res)
        },
        fail() {
          reject({
            code: 3,
            reason: 'OCR解析失败'
          })
        }
      })
    })
  }
}
