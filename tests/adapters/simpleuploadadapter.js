/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals document */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import SimpleUploadAdapter from '../../src/adapters/simpleuploadadapter';
import FileRepository from '../../src/filerepository';
import log from '@ckeditor/ckeditor5-utils/src/log';
import { createNativeFileMock } from '../_utils/mocks';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';

describe( 'SimpleUploadAdapter', () => {
	let editor, editorElement, sinonXHR, logStub, fileRepository;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );

		sinonXHR = testUtils.sinon.useFakeServer();
		logStub = testUtils.sinon.stub( log, 'warn' );

		return ClassicTestEditor
			.create( editorElement, {
				plugins: [ SimpleUploadAdapter ],
				simpleUpload: {
					uploadUrl: 'http://example.com'
				}
			} )
			.then( newEditor => {
				editor = newEditor;
				fileRepository = editor.plugins.get( FileRepository );
			} );
	} );

	afterEach( () => {
		sinonXHR.restore();
	} );

	it( 'should require the FileRepository plugin', () => {
		expect( SimpleUploadAdapter.requires ).to.deep.equal( [ FileRepository ] );
	} );

	it( 'should be named', () => {
		expect( SimpleUploadAdapter.pluginName ).to.equal( 'SimpleUploadAdapter' );
	} );

	describe( 'init()', () => {
		it( 'should activate the adapter', () => {
			return ClassicTestEditor
				.create( editorElement, {
					plugins: [ SimpleUploadAdapter ],
					simpleUpload: {
						uploadUrl: 'http://example.com'
					}
				} )
				.then( editor => {
					expect( editor.plugins.get( FileRepository ).createUploadAdapter ).is.a( 'function' );

					return editor.destroy();
				} );
		} );
	} );

	describe( 'UploadAdapter', () => {
		let adapter, loader;

		beforeEach( () => {
			const file = createNativeFileMock();
			file.name = 'image.jpeg';

			loader = fileRepository.createLoader( file );

			adapter = editor.plugins.get( FileRepository ).createUploadAdapter( loader );
		} );

		it( 'the crateAdapter() method should be registered and have upload() and abort methods()', () => {
			expect( adapter ).to.not.be.undefined;
			expect( adapter.upload ).to.be.a( 'function' );
			expect( adapter.abort ).to.be.a( 'function' );
		} );

		it( 'should not set the FileRepository.createUploadAdapter() factory if not configured', () => {
			const editorElement = document.createElement( 'div' );
			document.body.appendChild( editorElement );

			return ClassicTestEditor
				.create( editorElement, {
					plugins: [ SimpleUploadAdapter ],
				} )
				.then( editor => {
					const fileRepository = editor.plugins.get( FileRepository );

					expect( fileRepository ).to.not.have.property( 'createUploadAdapter' );

					editorElement.remove();

					return editor.destroy();
				} );
		} );

		it( 'should not set the FileRepository.createUploadAdapter() factory if not configured properly', () => {
			const editorElement = document.createElement( 'div' );
			document.body.appendChild( editorElement );

			return ClassicTestEditor
				.create( editorElement, {
					plugins: [ SimpleUploadAdapter ],
					simpleUpload: {
						// Missing "uploadUrl".
						foo: 'bar'
					}
				} )
				.then( editor => {
					expect( logStub.callCount ).to.equal( 1 );
					expect( logStub.firstCall.args[ 0 ] ).to.match( /^simple-upload-adapter-missing-uploadUrl/ );

					const fileRepository = editor.plugins.get( FileRepository );

					expect( fileRepository ).to.not.have.property( 'createUploadAdapter' );

					editorElement.remove();

					return editor.destroy();
				} );
		} );

		describe( 'upload()', () => {
			it( 'should return a Promise', () => {
				return loader.file
					.then( () => {
						expect( adapter.upload() ).to.be.instanceof( Promise );
					} );
			} );

			it( 'should call url from config', () => {
				let request;
				const validResponse = {
					url: 'http://example.com/images/image.jpeg'
				};

				const uploadPromise = adapter.upload();

				return loader.file
					.then( () => {
						request = sinonXHR.requests[ 0 ];
						request.respond( 200, { 'Content-Type': 'application/json' }, JSON.stringify( validResponse ) );

						expect( request.url ).to.equal( 'http://example.com' );

						return uploadPromise;
					} )
					.then( uploadResponse => {
						expect( uploadResponse ).to.be.a( 'object' );
						expect( uploadResponse ).to.have.property( 'default', 'http://example.com/images/image.jpeg' );
					} );
			} );

			it( 'should modify headers of uploading request if specified', () => {
				const editorElement = document.createElement( 'div' );
				document.body.appendChild( editorElement );

				return ClassicTestEditor
					.create( editorElement, {
						plugins: [ SimpleUploadAdapter ],
						simpleUpload: {
							uploadUrl: 'http://example.com',
							headers: {
								'X-CSRF-TOKEN': 'foo',
								Authorization: 'Bearer <token>'
							}
						}
					} )
					.then( editor => {
						const adapter = editor.plugins.get( FileRepository ).createUploadAdapter( loader );
						const validResponse = {
							url: 'http://example.com/images/image.jpeg'
						};

						const uploadPromise = adapter.upload();

						return loader.file
							.then( () => {
								const request = sinonXHR.requests[ 0 ];
								request.respond( 200, { 'Content-Type': 'application/json' }, JSON.stringify( validResponse ) );

								const requestHeaders = request.requestHeaders;

								expect( requestHeaders ).to.be.a( 'object' );
								expect( requestHeaders ).to.have.property( 'X-CSRF-TOKEN', 'foo' );
								expect( requestHeaders ).to.have.property( 'Authorization', 'Bearer <token>' );

								return uploadPromise;
							} )
							.then( uploadResponse => {
								expect( uploadResponse ).to.be.a( 'object' );
								expect( uploadResponse ).to.have.property( 'default', 'http://example.com/images/image.jpeg' );

								editorElement.remove();
							} )
							.then( () => editor.destroy() );
					} );
			} );

			it( 'should throw on a generic request error', () => {
				const promise = adapter.upload()
					.then( () => {
						throw new Error( 'Promise should throw.' );
					} )
					.catch( msg => {
						expect( msg ).to.equal( 'Couldn\'t upload file: image.jpeg.' );
					} );

				loader.file.then( () => {
					const request = sinonXHR.requests[ 0 ];
					request.error();
				} );

				return promise;
			} );

			it( 'should throw on an error from server', () => {
				const responseError = {
					error: {
						message: 'Foo bar baz.'
					}
				};

				const promise = adapter.upload()
					.then( () => {
						throw new Error( 'Promise should throw.' );
					} )
					.catch( msg => {
						expect( msg ).to.equal( 'Foo bar baz.' );
					} );

				loader.file.then( () => {
					const request = sinonXHR.requests[ 0 ];
					request.respond( 200, { 'Content-Type': 'application/json' }, JSON.stringify( responseError ) );
				} );

				return promise;
			} );

			it( 'should throw a generic error on an error from server without a message', () => {
				const responseError = {
					error: {}
				};

				const promise = adapter.upload()
					.then( () => {
						throw new Error( 'Promise should throw.' );
					} )
					.catch( msg => {
						expect( msg ).to.equal( 'Couldn\'t upload file: image.jpeg.' );
					} );

				loader.file.then( () => {
					const request = sinonXHR.requests[ 0 ];
					request.respond( 200, { 'Content-Type': 'application/json' }, JSON.stringify( responseError ) );
				} );

				return promise;
			} );

			it( 'should throw an error on abort()', () => {
				let request;

				const promise = adapter.upload()
					.then( () => {
						throw new Error( 'Promise should throw.' );
					} )
					.catch( () => {
						expect( request.aborted ).to.be.true;
					} );

				loader.file.then( () => {
					request = sinonXHR.requests[ 0 ];
					adapter.abort();
				} );

				return promise;
			} );

			it( 'abort() should not throw before upload', () => {
				expect( () => {
					adapter.abort();
				} ).to.not.throw();
			} );

			it( 'should update progress', () => {
				adapter.upload();

				return loader.file.then( () => {
					const request = sinonXHR.requests[ 0 ];
					request.uploadProgress( { loaded: 4, total: 10 } );

					expect( loader.uploadTotal ).to.equal( 10 );
					expect( loader.uploaded ).to.equal( 4 );
				} );
			} );
		} );
	} );
} );