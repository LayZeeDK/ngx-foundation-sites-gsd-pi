import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Placeholder } from './placeholder';

describe('Placeholder', () => {
  let component: Placeholder;
  let fixture: ComponentFixture<Placeholder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Placeholder],
    }).compileComponents();

    fixture = TestBed.createComponent(Placeholder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
