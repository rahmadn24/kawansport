import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from './product.entity';

/**
 * Keranjang belanja aktif per user (MP-02). Satu user tepat satu baris cart
 * (unique user_id); item tersimpan di `cart_items`. Cart dikosongkan setelah
 * checkout sukses (baris cart dipertahankan, item dihapus).
 */
@Entity('carts')
@Unique('uq_carts_user_id', ['userId'])
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: false })
  items?: CartItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/**
 * Satu baris cart: produk + jumlah. Unik per (cart, produk) — tambah produk
 * yang sama menimpa qty (via PUT /cart), bukan menambah baris.
 */
@Entity('cart_items')
@Unique('uq_cart_items_cart_product', ['cartId', 'productId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cart_id' })
  cartId!: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart?: Cart;

  @Column({ name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  /** Jumlah (>= 0 di DTO; qty 0 via PUT = hapus baris). */
  @Column({ type: 'int' })
  qty!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
