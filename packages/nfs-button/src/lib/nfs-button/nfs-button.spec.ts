import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfsButton } from './nfs-button';

describe('NfsButton', () => {
  let component: NfsButton;
  let fixture: ComponentFixture<NfsButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NfsButton],
    }).compileComponents();

    fixture = TestBed.createComponent(NfsButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
