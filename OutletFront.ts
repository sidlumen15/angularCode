@Component({
  selector: 'app-Shop-front',
  imports: [NgbAccordionModule, DecimalPipe, FormsModule, NgbTypeaheadModule, ServiceMethodPipe],
  templateUrl: './Shop-front.html',
  styleUrl: './Shop-front.scss',
})
export class ShopFront implements OnDestroy {
  destroy$ = new Subject();
  isLoading = true;
  menus: ShopMenu[] = [];
  alertMessage = '';
  ShopServices: ShopService[] = [];
  ShopData: Shop | null = null;
  cartInfo!: Cart;
  customerData: CustomerData[] = [];
  ShopDisabled = false;

  @ViewChild('instance', { static: true }) instance!: NgbTypeahead;

  constructor(
    private dataService: DataService,
    private ngbModal: NgbModal,
    private cartService: CartService,
    private catalogService: CatalogService,
    private loaderService: LoaderService,
    public orderService: OrderService,
    private configService: ConfigService,
  ) {
    this.loaderService.show();
    this.cartService.cartInfo$.pipe(takeUntil(this.destroy$)).subscribe((cart: Cart) => {
      this.cartInfo = cart;
    });

    this.catalogService.catalogMenus$.subscribe((menus: ShopMenu[]) => {
      this.menus = menus;
    });

    this.systemService();
    if (this.configService.custappConfig !== null) {
      this.customerData = this.configService.custappConfig.custapp_datas.filter(
        (td) => td.tag == 'menu-top',
      );
    }

    this.ShopDetails();
  }

  ShopDetails() {
    this.dataService
      .myHttp({ type: 'get', uri: 'shop_info', cacheSeconds: 3600 })
      .pipe(take(1))
      .subscribe((resp: ApiResponse) => {
        if (resp.status === 'ok') {
          this.ShopData = resp.data;
          if (resp.data.disable_upto) {
            this.ShopDisabled = this.isShopDisabled(resp.data.disable_upto);
          }
        }
      });
  }

  systemService() {
    this.dataService
      .myHttp({ type: 'get', uri: 'Shop_services', cacheSeconds: 3600 })
      .pipe(take(1))
      .subscribe((resp: ApiResponse) => {
        if (resp.status === 'ok') {
          resp.data.forEach((svc: ShopService) => {
            if (svc.service_name == 'collection' || svc.service_name == 'delivery') {
              if (!this.cartInfo.service_method && svc.is_enabled) {
                this.cartInfo.service_method = svc.service_name;
              }
              this.ShopServices.push(svc);
            }
          });

          if (this.cartInfo.service_method === '') {
            this.cartInfo.service_method = 'collection';
          }
        }
        this.loaderService.hide();
      });
  }

  changeServiceMethod() {
    this.cartService.updateCartProperties({
      service_method: this.cartInfo.service_method,
    });
  }

  get priceKey() {
    return this.cartInfo.service_method + '_price_int';
  }
  
  addShopItem(item: MenuItem, menuTypeId: number) {
    const modalRef = this.ngbModal.open(ItemModal, {
      centered: true,
      scrollable: true,
    });
    modalRef.componentInstance.catalogItem = item;
    modalRef.componentInstance.menuTypeId = menuTypeId;
  }

  itemPrice(item: MenuItem) {
    let itemPrice = item[this.priceKey] || 0;
    if (item.sub_items && item.sub_items.length) {
      const lowestObj = item.sub_items.reduce((prev, curr) =>
        curr[this.priceKey] < prev[this.priceKey] ? curr : prev,
      );
      itemPrice += lowestObj[this.priceKey] || 0;
    }
    return itemPrice;
  }

  filterModal() {
    const modalRef = this.ngbModal.open(FilterMenu, {
      scrollable: true,
    });
    modalRef.componentInstance.catalogMenus = this.menus;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.addShopItem(result.item, result.menu_type_id);
        }
      },
      (reason) => {
        console.log('Dismissed because:', reason);
      },
    );
  }

  isShopDisabled(disableUpto?: string | null): boolean {
    if (!disableUpto) return false;

    const now = new Date(); // user local time
    const disableDate = new Date(disableUpto); // respects +01:00 automatically

    return now < disableDate;
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }
}
