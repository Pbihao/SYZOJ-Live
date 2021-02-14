import * as TypeORM from "typeorm";
import Model from "./common";

import User from "./user";

@TypeORM.Entity()
export default class Printer extends Model{
  static cache = false;

  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({ nullable: true, type: "mediumtext"})
  print_content: string;

  @TypeORM.Column({ nullable: true, type: "integer"})
  user_id: number;

  @TypeORM.Column({ nullable: true, type: "mediumtext"})
  user_name: string;

  @TypeORM.Column({nullable: true, type: "integer"})
  submit_time: number;

  @TypeORM.Index()
  @TypeORM.Column({nullable: true, type: "boolean"})
  is_printed: boolean;

  user?: User;

  async loadRelationships(){
    this.user = await User.findById(this.user_id);
  }
}
