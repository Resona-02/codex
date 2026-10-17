/** quoted 用来区分文本中的 "in" 和 create 的归属子句。 */
export interface Token {
  readonly value: string;
  readonly quoted: boolean;
}
