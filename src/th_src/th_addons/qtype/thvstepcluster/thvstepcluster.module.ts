import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';

import { CoreQuestionDelegate } from '@features/question/services/question-delegate';
import { AddonQtypeThvstepclusterHandler } from './services/handlers/thvstepcluster';

import { AddonQtypeThvstepclusterComponent } from './component/thvstepcluster';

import { AddonQtypeMultichoiceModule } from '@addons/qtype/multichoice/multichoice.module';
import { AddonQtypeDescriptionModule } from '@addons/qtype/description/description.module';
import { AddonQtypeEssayModule } from '@addons/qtype/essay/essay.module';
import { AddonQtypeRecordRTCModule } from '../recordrtc/recordrtc.module';

@NgModule({
    imports: [
        CoreSharedModule,
        AddonQtypeThvstepclusterComponent,

        // Các loại question phụ thuộc
        AddonQtypeMultichoiceModule,
        AddonQtypeDescriptionModule,
        AddonQtypeEssayModule,
        AddonQtypeRecordRTCModule,
    ],

    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreQuestionDelegate.registerHandler(
                    AddonQtypeThvstepclusterHandler.instance,
                );
            },
        },
    ],
})
export class AddonQtypeThvstepclusterModule {}
