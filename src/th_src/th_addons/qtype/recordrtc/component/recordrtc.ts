import { Component, ElementRef, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { CoreComponentsModule } from '@components/components.module';

import { CoreFileUploader, CoreFileUploaderAudioRecording, CoreFileUploaderOptions } from '@features/fileuploader/services/fileuploader';
import { CoreFileUploaderHelper } from '@features/fileuploader/services/fileuploader-helper';
import { AddonModQuizEssayQuestion, CoreQuestionBaseComponent } from '@features/question/classes/base-question-component';
import { CoreQuestionHelper } from '@features/question/services/question-helper';
import { CoreFile, CoreFileProgressEvent } from '@services/file';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { MediaFile, CaptureError, CaptureVideoOptions } from '@awesome-cordova-plugins/media-capture/ngx';
import { CoreFileEntry, CoreFileHelper } from '@services/file-helper';
import { CoreWSFile, CoreWSFileUploadOptions, CoreWSPreSets, CoreWSUploadFileResult } from '@services/ws';
import { CorePlatform } from '@services/platform';
import { CoreUtils } from '@services/utils/utils';
import { CoreWSError } from '@classes/errors/wserror';
import { CoreError } from '@classes/errors/error';
import { CoreNetwork } from '@services/network';
import { CoreNetworkError } from '@classes/errors/network-error';
import { CoreTextUtils } from '@services/utils/text';
import { CoreErrorObject } from '@services/error-helper';
import { Translate } from '@singletons';
import { CoreHttpError } from '@classes/errors/httperror';
import { CoreSiteError, CoreSiteErrorOptions } from '@classes/errors/siteerror';
import { CoreUserGuestSupportConfig } from '@features/user/classes/support/guest-support-config';
import { CoreIonLoadingElement } from '@classes/ion-loading';
import $ from 'jquery';
import { CoreFormatTextDirective } from "@directives/format-text";
import { ThCoreFormatTextDirective } from "@/th_src/th_core/directives/th-format-text";

@Component({
    selector: 'addon-qtype-recordrtc',
    templateUrl: 'addon-qtype-recordrtc.html',

    standalone: true,

    imports: [
    IonicModule,
    CommonModule,
    CoreComponentsModule,
    CoreFormatTextDirective,
    ThCoreFormatTextDirective
],
})

export class AddonQtypeRecordRTCComponent extends CoreQuestionBaseComponent {

    @ViewChild('audioPlayer', { static: true }) audioPlayer!: ElementRef<HTMLAudioElement>;
    isRecording = false;
    mediaRecorder: any;
    questionText: string = "";
    recordedURL: string | undefined;
    seenInput?: { name: string; value: string };
    question2: any;
    audioUrl: string | undefined;
    renderAudio = false;
    recordingPlayer: string | null = "";
    audioInputValue: any;
    audioInputName: any;


    constructor(elementRef: ElementRef) {
        super();
    }

    /**
     * @inheritdoc
     */

    async startRecording() {


        let fullPath: string | undefined = undefined;

        if (CorePlatform.isMobile()) {
            const result = await CoreFileUploader.captureAudio();
            if (Array.isArray(result) && result.length > 0) {
                let audio = result[0];
                fullPath = audio.fullPath;
            }
        }

        else {
            const result = await CoreFileUploaderHelper.selectFile();
            fullPath = result.fullPath;
        }

        if (fullPath) {
            let site = await CoreSites.getCurrentSite();
            // File isn't too large and user confirmed, let's upload.
            const modal = await CoreDomUtils.showModalLoading("Upload");
            if (site) {
                try {
                    let result2: any = await this.uploadFile(fullPath,
                        {
                            itemId: this.audioInputValue,
                            fileName: "recording.mp3"
                        }, {
                        siteUrl: site.siteUrl,
                        wsToken: site.token
                    }, (progress) => {
                        this.showProgressModal(modal, 'core.fileuploader.uploadingperc', progress);
                    });

                    let newUrl = new URL(result2.url);
                    newUrl.searchParams.set("nocache", `${new Date().getTime()}`);

                    this.recordedURL = newUrl.toString();
                    this.recordingPlayer = `<audio src="${newUrl}" controls></audio>`;
                    this.renderAudio = true;
                } catch (error) {
                    this.audioPlayer.nativeElement.src = ""
                    this.logger.error('Error uploading file.', error);
                    modal.dismiss();
                } finally {
                    modal.dismiss();
                }
            }
        }
    }

    init(): void {

        if (this.question?.html) {


            let questiontextEl = $(this.question?.html).find(".qtext");
            let source = questiontextEl.find('.qtype_recordrtc-media-player audio source');
            const audioSrc = source[0].getAttribute('src');
            if (source.length) {
                this.recordingPlayer = `<audio src="${audioSrc}" controls></audio>`;
                this.renderAudio = true;

            }
            questiontextEl.find("div:last").remove();
            this.questionText = questiontextEl[0].innerHTML;
            const questionEl = CoreDomUtils.convertToElement(this.question.html);
            const audioInput = questionEl.querySelector<HTMLInputElement>('input[name*=_recording]');
            if (audioInput) {
                this.audioInputName = audioInput.name;
                this.audioInputValue = audioInput.value;
            }
        }
    }


    /**
 * Create an error to be thrown when it isn't possible to connect to a site.
 *
 * @param siteUrl Site url.
 * @param options Error options.
 * @returns Cannot connect error.
 */
    protected async createCannotConnectSiteError(
        siteUrl: string,
        options?: Partial<CoreSiteErrorOptions>,
    ): Promise<CoreSiteError> {
        return new CoreSiteError({
            ...options,
            supportConfig: await CoreUserGuestSupportConfig.forSite(siteUrl),
            message: CoreSites.isLoggedIn()
                ? Translate.instant('core.siteunavailablehelp', { site: CoreSites.getCurrentSite()?.siteUrl })
                : Translate.instant('core.sitenotfoundhelp'),
        });
    }


    protected createHttpError(error: CoreErrorObject, status: number): CoreHttpError {
        const message = CoreTextUtils.buildSeveralParagraphsMessage([
            CoreSites.isLoggedIn()
                ? Translate.instant('core.siteunavailablehelp', { site: CoreSites.getCurrentSite()?.siteUrl })
                : Translate.instant('core.sitenotfoundhelp'),
            CoreTextUtils.getHTMLBodyContent(CoreTextUtils.getErrorMessageFromError(error) || ''),
        ]);

        return new CoreHttpError(message, status);
    }


    async uploadFile(
        filePath: string,
        options: CoreWSFileUploadOptions,
        preSets: CoreWSPreSets,
        onProgress?: (event: ProgressEvent) => void,
    ): Promise<CoreWSUploadFileResult> {
        this.logger.debug(`Trying to upload file: ${filePath}`);

        if (!filePath || !options || !preSets) {
            throw new CoreError('Invalid options passed to upload file.');
        }

        if (!CoreNetwork.isOnline()) {
            throw new CoreNetworkError();
        }

        // const uploadUrl = preSets.siteUrl + '/webservice/upload.php';
        const uploadUrl = preSets.siteUrl + '/question/type/recordrtc/uploadrecording.php';
        const transfer = new window.FileTransfer();

        if (onProgress) {
            transfer.onprogress = onProgress;
        }

        options.httpMethod = 'POST';
        options.params = {
            token: preSets.wsToken,
            filearea: options.fileArea || 'draft',
            itemid: options.itemId || 0,
        };
        options.chunkedMode = false;
        options.headers = {
            'User-Agent': navigator.userAgent,
        };
        options['Connection'] = 'close';

        let success: FileUploadResult;

        try {
            success = await new Promise((resolve, reject) =>
                transfer.upload(filePath, uploadUrl, (result) => resolve(result), (error) => reject(error), options, true));
        } catch (error) {
            this.logger.error('Error while uploading file', filePath, error);

            throw this.createHttpError(error, error.http_status ?? 0);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = CoreTextUtils.parseJSON<any>(
            success.response,
            null,
            error => this.logger.error('Error parsing response from upload', success.response, error),
        );

        if (data === null) {
            throw await this.createCannotConnectSiteError(preSets.siteUrl, {
                debug: {
                    code: 'invalidresponse',
                    details: Translate.instant('core.errorinvalidresponse', { method: 'uploadrecording.php' }),
                },
            });
        }

        if (!data) {
            throw await this.createCannotConnectSiteError(preSets.siteUrl, {
                debug: {
                    code: 'serverconnectionupload',
                    details: Translate.instant('core.serverconnection', {
                        details: Translate.instant('core.errorinvalidresponse', { method: 'uploadrecording.php' }),
                    }),
                },
            });
        } else if (typeof data != 'object') {
            this.logger.warn('Upload file: Response of type "' + typeof data + '" received, expecting "object"');

            throw await this.createCannotConnectSiteError(preSets.siteUrl, {
                debug: {
                    code: 'invalidresponse',
                    details: Translate.instant('core.errorinvalidresponse', { method: 'uploadrecording.php' }),
                },
            });
        }

        if (data.exception !== undefined) {
            throw new CoreWSError(data);
        } else if (data.error !== undefined) {
            throw new CoreWSError({
                errorcode: data.errortype,
                message: data.error,
            });
        } else if (data[0] && data[0].error !== undefined) {
            throw new CoreWSError({
                errorcode: data[0].errortype,
                message: data[0].error,
            });
        }

        // We uploaded only 1 file, so we only return the first file returned.
        this.logger.debug('Successfully uploaded file', filePath);

        return data;
    }

    /**
    * Show a progress modal.
    *
    * @param modal The modal where to show the progress.
    * @param stringKey The key of the string to display.
    * @param progress The progress event.
    */
    protected showProgressModal(
        modal: CoreIonLoadingElement,
        stringKey: string,
        progress: ProgressEvent | CoreFileProgressEvent,
    ): void {
        if (!progress || !progress.lengthComputable || progress.loaded === undefined || !progress.total) {
            return;
        }

        // Calculate the progress percentage.
        const perc = Math.min((progress.loaded / progress.total) * 100, 100);

        if (isNaN(perc) || perc < 0) {
            return;
        }

        modal.updateText(Translate.instant(stringKey, { $a: perc.toFixed(1) }));
    }




}
