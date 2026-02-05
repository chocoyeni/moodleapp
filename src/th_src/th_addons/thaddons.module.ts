import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ThAddonQtypeModule } from './qtype/th-qtype.module';

@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        ThAddonQtypeModule,
    ],
})
export class ThAddonsModule {}
