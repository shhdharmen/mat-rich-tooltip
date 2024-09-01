import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MenuPositionX, MenuPositionY } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import {
  RichTooltipDirective,
  RickTooltipContentComponent,
  RickTooltipSubheadComponent,
  RickTooltipSupportingTextComponent,
  RickTooltipActionsComponent,
  RichTooltipBehavior
} from 'mat-rich-tooltip';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styles: `:host { display: block; margin: 16px; } .demo-container { padding: 16px; display: flex; align-items: center; justify-content: center; }`,
  imports: [
    MatIconModule,
    MatButtonModule,
    RichTooltipDirective,
    RickTooltipContentComponent,
    RickTooltipSubheadComponent,
    RickTooltipSupportingTextComponent,
    RickTooltipActionsComponent,
    FormsModule,
    MatRadioModule,
    MatSelectModule,
    MatTabsModule
],
})
export class AppComponent {
  behavior: RichTooltipBehavior = 'persistent';
  action = true;
  disabled = false;

  xPositionOptions: MenuPositionX[] = ['after','before'];
  yPositionOptions: MenuPositionY[] = ['below', 'above'];
  xPosition: MenuPositionX = 'after';
  yPosition: MenuPositionY = 'below';
}
