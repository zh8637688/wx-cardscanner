import CardScanner from '../cardscanner/cardscanner.js'
Page({
  onLoad(options) {
    let that = this
    this.imgPath = options.imgPath
    this.cardScanner = new CardScanner(this)
      .on('ImageChanged', (imgPath) => {
        that.imgPath = imgPath
        console.log(imgPath)
      })
      .on('DecodeStart', (imgPath) => {
        wx.showLoading({
          title: '解析中',
          mask: true
        })
      })
      .on('DecodeComplete', (res) => {
        if (res.code == 0) {
          wx.showModal({
            title: '',
            content: JSON.stringify(res.data),
          })
        } else {
          console.log('解析失败：' + res.reason)
        }
        wx.hideLoading()
      })
  },

  onReady() {
    this.cardScanner.setImage(this.imgPath)
  }
})