/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module upload/adapters/base64uploadadapter
 */

/* globals window */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import FileRepository from '../filerepository';

/**
 * A plugin that converts images inserted into the editor into [Base64 strings](https://en.wikipedia.org/wiki/Base64)
 * in the {@glink builds/guides/integration/saving-data editor output}.
 *
 * This kind of image upload does not require server processing – images are stored with the rest of the text and
 * displayed by the web browser without additional requests.
 *
 * Check out the {@glink features/image-upload/image-upload comprehensive "Image upload overview"} to learn about
 * other ways to upload images into CKEditor 5.
 *
 * @extends module:core/plugin~Plugin
 */
export default class Base64UploadAdapter extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ FileRepository ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'Base64UploadAdapter';
	}

	static compressRadio = 0.7

	/**
	 * @inheritDoc
	 */
	init() {
		this.editor.plugins.get( FileRepository ).createUploadAdapter = loader => new Adapter( loader );
	}
}

/**
 * The upload adapter that converts images inserted into the editor into Base64 strings.
 *
 * @private
 * @implements module:upload/filerepository~UploadAdapter
 */
class Adapter {
	/**
	 * Creates a new adapter instance.
	 *
	 * @param {module:upload/filerepository~FileLoader} loader
	 */
	constructor( loader ) {
		/**
		 * `FileLoader` instance to use during the upload.
		 *
		 * @member {module:upload/filerepository~FileLoader} #loader
		 */
		this.loader = loader;
	}

	/**
	 * Starts the upload process.
	 *
	 * @see module:upload/filerepository~UploadAdapter#upload
	 * @returns {Promise}
	 */
	upload() {
		return new Promise( ( resolve, reject ) => {
			const reader = this.reader = new window.FileReader();

			// ##Less-Adjust
			reader.addEventListener( 'load', () => {
				// resolve( { default: reader.result } );
				this.compressBase64Img(reader.result, (b)=>{
					resolve( { default: b } );
				}, Base64UploadAdapter.compressRadio)
			} );
			// ##Less-Adjust

			reader.addEventListener( 'error', err => {
				reject( err );
			} );

			reader.addEventListener( 'abort', () => {
				reject();
			} );

			this.loader.file.then( file => {
				reader.readAsDataURL( file );
			} );
		} );
	}

	/**
	 * Aborts the upload process.
	 *
	 * @see module:upload/filerepository~UploadAdapter#abort
	 * @returns {Promise}
	 */
	abort() {
		this.reader.abort();
	}

	// ##Less-Adjust
	// 图片处理
	/**
	 * 
	 * @param {图片base64字符串} base64 
	 * @param {*结果回调} callback 
	 * @param {*压缩系数0-1之间} quality 
	 * @param {*宽高限制，如果宽或高超过则等比例缩小至该值，默认2048} widthHeightMax 
	 * @param {*图片最大容量限制，kb值，默认1024} sizeMax 
	 */
	compressBase64Img (base64, callback, quality, widthHeightMax=2048, sizeMax=1024) {
		var newImage = new Image();
		// var quality = 0.6;    //压缩系数0-1之间
		// console.log("quality/widthHeightMax/sizeMax = ", quality,'/', widthHeightMax,'/', sizeMax);
		newImage.src = base64;
		newImage.setAttribute("crossOrigin", 'Anonymous');	//url为外域时需要
		var imgWidth, imgHeight;
		newImage.onload = function () {
			imgWidth = this.width;
			imgHeight = this.height;
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			if (Math.max(imgWidth, imgHeight) > widthHeightMax) {
				if (imgWidth > imgHeight) {
					canvas.width = widthHeightMax;
					canvas.height = widthHeightMax * imgHeight / imgWidth;
				} else {
					canvas.height = widthHeightMax;
					canvas.width = widthHeightMax * imgWidth / imgHeight;
				}
			} else {
				canvas.width = imgWidth;
				canvas.height = imgHeight;
				quality = 0.6;
			}
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
			var base64 = canvas.toDataURL("image/jpeg", quality); //压缩语句
			// 如想确保图片压缩到自己想要的尺寸,如要求在sizeMax kb之间，请加以下语句，quality初始值根据情况自定
			while (base64.length / 1024 > sizeMax) {
				quality -= 0.01;
				base64 = canvas.toDataURL("image/jpeg", quality);
			}
			// 防止最后一次压缩低于最低尺寸，只要quality递减合理，无需考虑
			// while (base64.length / 1024 < 50) {
			// 	quality += 0.001;
			// 	base64 = canvas.toDataURL("image/jpeg", quality);
			// }
			callback(base64);//必须通过回调函数返回，否则无法及时拿到该值
		}
	}
	// ##Less-Adjust
}
