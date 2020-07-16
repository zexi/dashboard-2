import {
  getNameDescriptionTableColumn,
  getTimeTableColumn,
  getProjectTableColumn,
} from '@/utils/common/tableColumn'

export default {
  created () {
    this.columns = [
      getNameDescriptionTableColumn({
        onManager: this.onManager,
        hideField: true,
        title: '策略组名称',
        slotCallback: row => {
          return (
            <side-page-trigger onTrigger={ () => this.handleOpenSidepage(row) }>{ row.name }</side-page-trigger>
          )
        },
      }),
      {
        field: 'acl_entries',
        title: '源地址 | 备注',
        width: 150,
        type: 'expand',
        slots: {
          content: ({ row }, h) => {
            const arr = []
            if (row.acl_entries && row.acl_entries.length > 0) {
              row.acl_entries.forEach(obj => {
                let text = obj.cidr
                if (obj.comment) {
                  text += ` | ${obj.comment}`
                }
                arr.push({
                  value: text,
                })
              })
            }
            const ret = []
            if (arr.length > 0) {
              ret.push(
                <div class='mb-2'>
                  { arr.map(item => <a-tag>{ item.value }</a-tag>) }
                </div>,
              )
            }
            if (ret.length <= 0) {
              ret.push(
                <div>暂无源地址 | 备注</div>,
              )
            }
            return ret
          },
        },
      },
      getTimeTableColumn(),
      {
        field: 'updated_at',
        title: '更新时间',
        width: 150,
        formatter: ({ cellValue }) => {
          return this.$moment(cellValue).format()
        },
      },
      getProjectTableColumn(),
    ]
  },
}
